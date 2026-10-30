import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { trace } from "@opentelemetry/api"
import { toSql } from "pgvector"
import type { DataSource, SelectQueryBuilder } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { DEFAULT_TOP_K } from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import type { RetrievedDocumentChunk } from "./document-chunk.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EmbedderService } from "./embedders/embedder.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelsService } from "./project-embedding-models/project-embedding-models.service"

@Injectable()
export class DocumentChunkRetrievalService {
  private readonly logger = new Logger(DocumentChunkRetrievalService.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly projectEmbeddingModelsService: ProjectEmbeddingModelsService,
    private readonly embedderService: EmbedderService,
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
    /** The agent's model. Undefined means the project's default. */
    embeddingModel?: EmbeddingModel
  }): Promise<RetrievedDocumentChunk[]> {
    const retrievalQueryText = this.buildRetrievalQueryText({
      query,
    })
    // The project's ready models, its default first: the only ones with every chunk embedded.
    const completedModels =
      await this.projectEmbeddingModelsService.listCompletedModelNames(connectScope)
    const requestedModel = embeddingModel ?? completedModels[0]
    const embedded = await this.embedQueryWithAvailableModel({
      connectScope,
      query: retrievalQueryText,
      requestedModel,
      completedModels,
    })
    if (!embedded) {
      this.reportMissingEmbeddings({ connectScope, requestedModel })
      return []
    }
    const { modelName, embedding } = embedded
    this.recordEmbeddingModelOnSpan({ requestedModel, modelName })

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

  /**
   * Shows in the trace which model embedded the query. The AI SDK runs the lookup tool inside an
   * `ai.toolCall` span, so Phoenix lists these next to the tool's input and output.
   */
  private recordEmbeddingModelOnSpan({
    requestedModel,
    modelName,
  }: {
    requestedModel: string | undefined
    modelName: string
  }): void {
    const activeSpan = trace.getActiveSpan()
    activeSpan?.setAttribute("ai.telemetry.metadata.embeddingModel", modelName)
    if (requestedModel && requestedModel !== modelName) {
      activeSpan?.setAttribute("ai.telemetry.metadata.embeddingFallbackFrom", requestedModel)
    }
  }

  /**
   * Every project has a ready model, so no usable one means the project lost them or every
   * embedder failed: the answer would come from nothing, so it shows in the logs and the trace.
   */
  private reportMissingEmbeddings({
    connectScope,
    requestedModel,
  }: {
    connectScope: RequiredConnectScope
    requestedModel: string | undefined
  }): void {
    this.logger.warn(
      `No usable embedding model (requested ${requestedModel ?? "none"}) for project ${connectScope.projectId}: retrieval returns no passage`,
    )
    trace.getActiveSpan()?.setAttribute("ai.telemetry.metadata.embeddingModelMissing", true)
  }

  /**
   * Embeds the query with the agent's model when the project finished embedding with it, and
   * otherwise with the next ready model of the project. An embedder failure (down, timeout) moves
   * to the next model with a warning rather than failing the chat turn: the answer is a little
   * less relevant, not absent.
   */
  private async embedQueryWithAvailableModel({
    connectScope,
    query,
    requestedModel,
    completedModels,
  }: {
    connectScope: RequiredConnectScope
    query: string
    requestedModel: string | undefined
    completedModels: string[]
  }): Promise<{ modelName: string; embedding: number[] } | undefined> {
    if (requestedModel && !completedModels.includes(requestedModel)) {
      this.logger.warn(
        `Project ${connectScope.projectId} has not finished embedding with ${requestedModel}, trying its other models`,
      )
    }
    const candidateModels = [
      ...new Set([
        ...(requestedModel && completedModels.includes(requestedModel) ? [requestedModel] : []),
        ...completedModels,
      ]),
    ]
    for (const modelName of candidateModels) {
      try {
        const embedding = await this.embedderService.embedQuery({ modelName, text: query })
        return { modelName, embedding }
      } catch (error) {
        this.logger.warn(
          `Query embedding with ${modelName} failed for project ${connectScope.projectId}, trying the next model: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
    return undefined
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
        // webCrawl: the legacy web crawls stay searchable until the maintenance job migrates them.
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

    // A document matches through its own tags or through the tags of its document source.
    queryBuilder.andWhere(
      `(
        EXISTS (
          SELECT 1
          FROM document_document_tag document_tag_link
          WHERE document_tag_link.document_id = document.id
            AND document_tag_link.document_tag_id IN (:...documentTagIds)
        )
        OR EXISTS (
          SELECT 1
          FROM document_source_document_tag source_tag_link
          WHERE source_tag_link.document_source_id = document.document_source_id
            AND source_tag_link.document_tag_id IN (:...documentTagIds)
        )
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
}
