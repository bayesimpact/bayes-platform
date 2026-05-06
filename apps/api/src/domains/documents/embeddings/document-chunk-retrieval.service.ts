import { createVertex } from "@ai-sdk/google-vertex"
import { Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { embed } from "ai"
import { toSql } from "pgvector"
import type { DataSource, SelectQueryBuilder } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { DEFAULT_TOP_K } from "@/domains/agents/shared/agent-session-messages/streaming/tools/retrieve-project-document-chunks.tool"
import { resolveEmbeddingModelNames, resolveVertexConfig } from "./document-embeddings.config"

const PARENT_DEDUPLICATION_FETCH_MULTIPLIER = 5

export type RetrievedDocumentChunk = {
  chunkId: string
  documentId: string
  documentTitle: string
  documentFileName: string | null
  chunkIndex: number
  content: string
  distance: number
  modelName: string
  isParentChunk: boolean
}

@Injectable()
export class DocumentChunkRetrievalService {
  private readonly logger = new Logger(DocumentChunkRetrievalService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async retrieveTopChunks({
    connectScope,
    conversationSummary,
    latestUserQuestion,
    topK = DEFAULT_TOP_K,
    documentTagIds = [],
  }: {
    connectScope: RequiredConnectScope
    conversationSummary: string
    latestUserQuestion: string
    topK?: number
    documentTagIds?: string[]
  }): Promise<RetrievedDocumentChunk[]> {
    const retrievalQueryText = this.buildRetrievalQueryText({
      conversationSummary,
      latestUserQuestion,
    })
    const modelName = this.resolvePrimaryModelName()
    if (!modelName) {
      return []
    }

    const normalizedTopK = this.normalizeTopK(topK)
    const normalizedDocumentTagIds = this.normalizeDocumentTagIds(documentTagIds)
    const embedding = await this.embedQuery({ query: retrievalQueryText, modelName })

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
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select("COALESCE(parent.id, chunk.id)", "chunkId")
      .addSelect("chunk.document_id", "documentId")
      .addSelect("document.title", "documentTitle")
      .addSelect("document.file_name", "documentFileName")
      .addSelect("COALESCE(parent.chunk_index, chunk.chunk_index)", "chunkIndex")
      .addSelect("COALESCE(parent.content, chunk.content)", "content")
      .addSelect("embedding.model_name", "modelName")
      .addSelect("(embedding.embedding <=> :queryEmbedding::vector)", "distance")
      .addSelect("(parent.id IS NOT NULL)", "isParentChunk")
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
      .andWhere("document.source_type = :projectSourceType", { projectSourceType: "project" })
      .andWhere("chunk.deleted_at IS NULL")
      .andWhere("embedding.deleted_at IS NULL")
      .andWhere("document.deleted_at IS NULL")

    this.applyDocumentTagFilter({ queryBuilder, documentTagIds })

    const rows = await queryBuilder
      .setParameters({ queryEmbedding: toSql(embedding) })
      .orderBy("embedding.embedding <=> :queryEmbedding::vector", "ASC")
      .limit(topK * PARENT_DEDUPLICATION_FETCH_MULTIPLIER)
      .getRawMany<RetrievedDocumentChunk>()

    const seenIds = new Set<string>()
    const deduplicated: RetrievedDocumentChunk[] = []
    for (const row of rows) {
      if (seenIds.has(row.chunkId)) continue
      seenIds.add(row.chunkId)
      deduplicated.push({
        ...row,
        isParentChunk: Boolean(row.isParentChunk),
      })
      if (deduplicated.length === topK) break
    }
    return deduplicated
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

  private buildRetrievalQueryText({
    conversationSummary,
    latestUserQuestion,
  }: {
    conversationSummary: string
    latestUserQuestion: string
  }): string {
    return [
      "Conversation summary:",
      conversationSummary.trim(),
      "",
      "Latest user question:",
      latestUserQuestion.trim(),
    ].join("\n")
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
