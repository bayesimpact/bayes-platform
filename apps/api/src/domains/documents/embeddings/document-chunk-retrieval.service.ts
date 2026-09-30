import { createVertex } from "@ai-sdk/google-vertex"
import { type EmbeddingModel, isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { embed } from "ai"
import { toSql } from "pgvector"
import type { DataSource, SelectQueryBuilder } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { DEFAULT_TOP_K } from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import type { RetrievedDocumentChunk } from "./document-chunk.types"
import { resolveEmbeddingModelNames, resolveVertexConfig } from "./document-embeddings.config"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelRepository } from "./project-embedding-models/project-embedding-model.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BullMqQueryEmbeddingsClientService } from "./query-embeddings/bull-mq-query-embeddings-client.service"

@Injectable()
export class DocumentChunkRetrievalService {
  private readonly logger = new Logger(DocumentChunkRetrievalService.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly projectEmbeddingModelRepository: ProjectEmbeddingModelRepository,
    private readonly queryEmbeddingsClient: BullMqQueryEmbeddingsClientService,
  ) {}

  async retrieveTopChunks({
    connectScope,
    query,
    topK = DEFAULT_TOP_K,
    documentTagIds = [],
    embeddingModel,
  }: {
    connectScope: RequiredConnectScope
    query: string
    topK?: number
    documentTagIds?: string[]
    /** The agent's choice; a local model only applies once the project finished embedding with it. */
    embeddingModel?: EmbeddingModel | null
  }): Promise<RetrievedDocumentChunk[]> {
    const retrievalQueryText = this.buildRetrievalQueryText({
      query,
    })
    const embedded = await this.embedQueryWithAgentModel({
      projectId: connectScope.projectId,
      query: retrievalQueryText,
      embeddingModel,
    })
    if (!embedded) {
      return []
    }
    const { modelName, embedding } = embedded

    const normalizedTopK = this.normalizeTopK(topK)
    const normalizedDocumentTagIds = this.normalizeDocumentTagIds(documentTagIds)

    const results = await this.fetchChunksByEmbedding({
      connectScope,
      modelName,
      embedding,
      topK: normalizedTopK,
      documentTagIds: normalizedDocumentTagIds,
    })
    this.logRetrievalResult({
      projectId: connectScope.projectId,
      modelName,
      chunkCount: results.length,
    })
    return results
  }

  private resolvePrimaryModelName(): string | undefined {
    return resolveEmbeddingModelNames()[0]
  }

  /**
   * Embeds the query with the agent's local model when the project has it ready, and with the
   * Vertex default otherwise. A local failure (workers down, timeout) falls back to Vertex with a
   * warning rather than failing the chat turn: the answer is a little less relevant, not absent.
   */
  private async embedQueryWithAgentModel({
    projectId,
    query,
    embeddingModel,
  }: {
    projectId: string
    query: string
    embeddingModel?: EmbeddingModel | null
  }): Promise<{ modelName: string; embedding: number[] } | undefined> {
    if (embeddingModel && isLocalEmbeddingModel(embeddingModel)) {
      const isReady = await this.projectEmbeddingModelRepository.isCompleted({
        projectId,
        modelName: embeddingModel,
      })
      if (!isReady) {
        this.logger.warn(
          `Embedding model ${embeddingModel} is not ready for project ${projectId}, falling back to the default model`,
        )
      } else {
        try {
          const embedding = await this.queryEmbeddingsClient.embedQuery({
            modelName: embeddingModel,
            text: query,
          })
          return { modelName: embeddingModel, embedding }
        } catch (error) {
          this.logger.warn(
            `Local query embedding with ${embeddingModel} failed for project ${projectId}, falling back to the default model: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
    }

    const modelName = this.resolvePrimaryModelName()
    if (!modelName) {
      return undefined
    }
    const embedding = await this.embedQuery({ query, modelName })
    return { modelName, embedding }
  }

  private normalizeTopK(topK: number): number {
    return Math.max(1, topK)
  }

  private normalizeDocumentTagIds(documentTagIds: string[]): string[] {
    return [...new Set(documentTagIds.filter(Boolean))]
  }

  private async fetchChunksByEmbedding({
    connectScope,
    modelName,
    embedding,
    topK,
    documentTagIds,
  }: {
    connectScope: RequiredConnectScope
    modelName: string
    embedding: number[]
    topK: number
    documentTagIds: string[]
  }): Promise<RetrievedDocumentChunk[]> {
    const dedupedChunks = this.buildDedupedChunksQuery({
      connectScope,
      modelName,
      embedding,
    })
    this.applyDocumentTagFilter({ queryBuilder: dedupedChunks, documentTagIds })

    const rows = await this.buildTopChunksQuery({
      dedupedChunks,
      topK,
    }).getRawMany<RetrievedDocumentChunk>()

    // The SQL already collapses children of the same parent via DISTINCT ON, so
    // chunkId is unique. This is a defensive guard against any future query
    // regression re-introducing duplicate chunks into the LLM context.
    const seenChunkIds = new Set<string>()
    return rows
      .filter((row) => {
        if (seenChunkIds.has(row.chunkId)) {
          return false
        }
        seenChunkIds.add(row.chunkId)
        return true
      })
      .map((row) => ({
        ...row,
        isParentChunk: Boolean(row.isParentChunk),
      }))
  }

  /**
   * Rank all matching child chunks by vector distance, then collapse children
   * of the same parent down to the single best-scoring one via DISTINCT ON.
   */
  private buildDedupedChunksQuery({
    connectScope,
    modelName,
    embedding,
  }: {
    connectScope: RequiredConnectScope
    modelName: string
    embedding: number[]
  }): SelectQueryBuilder<Record<string, unknown>> {
    return this.dataSource
      .createQueryBuilder()
      .select("COALESCE(parent.id, chunk.id)", "chunkId")
      .addSelect("chunk.document_id", "documentId")
      .addSelect("document.title", "documentTitle")
      .addSelect("document.file_name", "documentFileName")
      .addSelect("COALESCE(parent.chunk_index, chunk.chunk_index)", "chunkIndex")
      .addSelect("COALESCE(parent.content, chunk.content)", "content")
      .addSelect("document.source_type", "documentSourceType")
      .addSelect("chunk.chunk_index", "chunkIndex")
      .addSelect("chunk.content", "content")
      .addSelect("embedding.model_name", "modelName")
      .addSelect("(embedding.embedding <=> :queryEmbedding::vector)", "distance")
      .addSelect("(parent.id IS NOT NULL)", "isParentChunk")
      .distinctOn(["COALESCE(parent.id, chunk.id)"])
      .from("document_chunk_embedding", "embedding")
      .innerJoin("document_chunk", "chunk", "chunk.id = embedding.document_chunk_id")
      .innerJoin("document", "document", "document.id = chunk.document_id")
      .leftJoin(
        "document_parent_chunk",
        "parent",
        "parent.id = chunk.parent_id AND parent.deleted_at IS NULL",
      )
      .where("embedding.organization_id = :organizationId", {
        organizationId: connectScope.organizationId,
      })
      .andWhere("embedding.project_id = :projectId", {
        projectId: connectScope.projectId,
      })
      .andWhere("embedding.model_name = :modelName", { modelName })
      .andWhere("document.embedding_status = :embeddingStatus", {
        embeddingStatus: "completed",
      })
      .andWhere("document.source_type IN (:...allowedSourceTypes)", {
        allowedSourceTypes: ["project", "webCrawl", "app"],
      })
      .andWhere("chunk.deleted_at IS NULL")
      .andWhere("embedding.deleted_at IS NULL")
      .andWhere("document.deleted_at IS NULL")
      .setParameters({ queryEmbedding: toSql(embedding) })
      .orderBy("COALESCE(parent.id, chunk.id)")
      .addOrderBy("embedding.embedding <=> :queryEmbedding::vector", "ASC")
  }

  /**
   * Wrap the deduplicated chunks subquery, re-sort by distance and take topK.
   */
  private buildTopChunksQuery({
    dedupedChunks,
    topK,
  }: {
    dedupedChunks: SelectQueryBuilder<Record<string, unknown>>
    topK: number
  }): SelectQueryBuilder<Record<string, unknown>> {
    return this.dataSource
      .createQueryBuilder()
      .select("*")
      .from(`(${dedupedChunks.getQuery()})`, "deduplicated")
      .setParameters(dedupedChunks.getParameters())
      .orderBy('"distance"', "ASC")
      .limit(topK)
  }

  private applyDocumentTagFilter({
    queryBuilder,
    documentTagIds,
  }: {
    queryBuilder: SelectQueryBuilder<Record<string, unknown>>
    documentTagIds: string[]
  }): void {
    if (documentTagIds.length === 0) {
      return
    }

    queryBuilder.andWhere(
      `EXISTS (
        SELECT 1
        FROM document_document_tag document_tag_link
        WHERE document_tag_link.document_id = document.id
          AND document_tag_link.document_tag_id IN (:...documentTagIds)
      )`,
      { documentTagIds },
    )
  }

  private logRetrievalResult({
    projectId,
    modelName,
    chunkCount,
  }: {
    projectId: string
    modelName: string
    chunkCount: number
  }): void {
    this.logger.log(
      `Retrieved ${chunkCount} chunks for project ${projectId} using model ${modelName}`,
    )
  }

  private buildRetrievalQueryText({ query }: { query: string }): string {
    return query.trim()
  }

  private async embedQuery({
    query,
    modelName,
  }: {
    query: string
    modelName: string
  }): Promise<number[]> {
    const { project, location } = resolveVertexConfig()
    const vertexProvider = createVertex({ project, location })
    const embeddingModel = vertexProvider.textEmbeddingModel(modelName)
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
    })
    return embedding
  }
}
