import { randomUUID } from "node:crypto"
import { createVertex } from "@ai-sdk/google-vertex"
import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { embedMany } from "ai"
import { toSql } from "pgvector"
import type { DataSource } from "typeorm"
import type { DoclingChunk, DoclingParentChunk } from "@/external/docling/docling.types"
import type { Document } from "../document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import {
  resolveEmbeddingModelNames,
  resolveMaxVertexEmbeddingBatchSize,
  resolveVertexConfig,
} from "./document-embeddings.config"
import type { CreateDocumentEmbeddingsJobPayload } from "./document-embeddings.types"

type ChunkInsertionScope = {
  documentId: string
  organizationId: string
  projectId: string
}

@Injectable()
export class DocumentEmbeddingsSharedService {
  private readonly logger = new Logger(DocumentEmbeddingsSharedService.name)

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly embeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findDocumentOrThrow(payload: CreateDocumentEmbeddingsJobPayload): Promise<Document> {
    const connectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }
    const document = await this.documentsService.findById({
      connectScope,
      documentId: payload.documentId,
    })
    if (!document) {
      throw new NotFoundException(`Document ${payload.documentId} not found`)
    }
    return document
  }

  async markDocumentStatus(document: Document, status: Document["embeddingStatus"]): Promise<void> {
    document.embeddingStatus = status
    if (status === "processing" || status === "completed") {
      document.embeddingError = null
    }
    await this.saveDocumentAndNotify(document)
  }

  async generateEmbeddingsByModel(chunks: string[]): Promise<Map<string, number[][]>> {
    const { project, location } = resolveVertexConfig()
    const embeddingModelNames = resolveEmbeddingModelNames()
    const maxVertexEmbeddingBatchSize = resolveMaxVertexEmbeddingBatchSize()
    this.logger.log(
      `Creating embeddings with Vertex models [${embeddingModelNames.join(", ")}] in project ${project}, location ${location}`,
    )

    const vertexProvider = createVertex({ project, location })
    const embeddingsByModelName = new Map<string, number[][]>()
    for (const embeddingModelName of embeddingModelNames) {
      const embeddingModel = vertexProvider.textEmbeddingModel(embeddingModelName)
      const embeddings: number[][] = []

      for (
        let batchStartIndex = 0;
        batchStartIndex < chunks.length;
        batchStartIndex += maxVertexEmbeddingBatchSize
      ) {
        const chunkBatch = chunks.slice(
          batchStartIndex,
          batchStartIndex + maxVertexEmbeddingBatchSize,
        )
        const { embeddings: batchEmbeddings } = await embedMany({
          model: embeddingModel,
          values: chunkBatch,
        })
        embeddings.push(...batchEmbeddings)
      }

      embeddingsByModelName.set(embeddingModelName, embeddings)
    }
    return embeddingsByModelName
  }

  async insertChunks({
    scope,
    chunks,
    doclingChunks,
    doclingParentChunks,
    embeddingsByModelName,
  }: {
    scope: ChunkInsertionScope
    chunks: string[]
    doclingChunks?: DoclingChunk[]
    doclingParentChunks?: DoclingParentChunk[]
    embeddingsByModelName: Map<string, number[][]>
  }): Promise<void> {
    await this.deleteExistingChunks(scope.documentId)
    await this.insertChildChunks({ scope, chunks, doclingChunks, embeddingsByModelName })
    if (doclingParentChunks) {
      await this.insertParentChunks({ scope, doclingParentChunks })
    }
  }

  private async saveDocumentAndNotify(document: Document): Promise<void> {
    const savedDocument = await this.documentsService.saveOne(document)
    await this.embeddingStatusNotifierService.notifyEmbeddingStatusChanged({
      documentId: savedDocument.id,
      organizationId: savedDocument.organizationId,
      projectId: savedDocument.projectId,
      embeddingStatus: savedDocument.embeddingStatus,
      embeddingError: savedDocument.embeddingError ?? null,
      updatedAt: savedDocument.updatedAt.getTime(),
    })
  }

  /** Embeddings are cascade-deleted via FK from document_chunk_embedding. */
  private async deleteExistingChunks(documentId: string): Promise<void> {
    await Promise.all([
      this.dataSource.query(`DELETE FROM document_chunk WHERE document_id = $1`, [documentId]),
      this.dataSource.query(`DELETE FROM document_parent_chunk WHERE document_id = $1`, [
        documentId,
      ]),
    ])
  }

  private async insertChildChunks({
    scope,
    chunks,
    doclingChunks,
    embeddingsByModelName,
  }: {
    scope: ChunkInsertionScope
    chunks: string[]
    doclingChunks?: DoclingChunk[]
    embeddingsByModelName: Map<string, number[][]>
  }): Promise<void> {
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const doclingChunk = doclingChunks?.[chunkIndex]
      const chunkId = doclingChunk?.chunk_id ?? randomUUID()
      await this.insertChildChunkRow({
        scope,
        chunkId,
        chunkIndex,
        embedText: chunks[chunkIndex] ?? "",
        doclingChunk,
      })
      await this.insertEmbeddingsForChunk({
        scope,
        chunkId,
        chunkIndex,
        embeddingsByModelName,
      })
    }
  }

  private async insertChildChunkRow({
    scope,
    chunkId,
    chunkIndex,
    embedText,
    doclingChunk,
  }: {
    scope: ChunkInsertionScope
    chunkId: string
    chunkIndex: number
    embedText: string
    doclingChunk?: DoclingChunk
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO document_chunk (id, created_at, updated_at, organization_id, project_id, document_id, content, embed_text, chunk_index, parent_id, prev_chunk_id, next_chunk_id, headings, captions)
       VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        chunkId,
        scope.organizationId,
        scope.projectId,
        scope.documentId,
        doclingChunk?.text ?? embedText,
        embedText,
        chunkIndex,
        doclingChunk?.parent_id ?? null,
        doclingChunk?.prev_chunk_id ?? null,
        doclingChunk?.next_chunk_id ?? null,
        JSON.stringify(doclingChunk?.headings ?? []),
        JSON.stringify(doclingChunk?.captions ?? []),
      ],
    )
  }

  private async insertEmbeddingsForChunk({
    scope,
    chunkId,
    chunkIndex,
    embeddingsByModelName,
  }: {
    scope: ChunkInsertionScope
    chunkId: string
    chunkIndex: number
    embeddingsByModelName: Map<string, number[][]>
  }): Promise<void> {
    for (const [embeddingModelName, embeddings] of embeddingsByModelName.entries()) {
      // NOTE: raw SQL because TypeORM 0.3.28 does not support pgvector columns.
      await this.dataSource.query(
        `INSERT INTO document_chunk_embedding (id, created_at, updated_at, organization_id, project_id, document_chunk_id, model_name, embedding)
         VALUES (uuid_generate_v4(), now(), now(), $1, $2, $3, $4, $5::vector)`,
        [
          scope.organizationId,
          scope.projectId,
          chunkId,
          embeddingModelName,
          toSql(embeddings[chunkIndex]),
        ],
      )
    }
  }

  private async insertParentChunks({
    scope,
    doclingParentChunks,
  }: {
    scope: ChunkInsertionScope
    doclingParentChunks: DoclingParentChunk[]
  }): Promise<void> {
    for (const [chunkIndex, parentChunk] of doclingParentChunks.entries()) {
      await this.dataSource.query(
        `INSERT INTO document_parent_chunk (id, created_at, updated_at, organization_id, project_id, document_id, content, embed_text, chunk_index, prev_chunk_id, next_chunk_id, headings, captions)
         VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          parentChunk.chunk_id,
          scope.organizationId,
          scope.projectId,
          scope.documentId,
          parentChunk.text,
          parentChunk.embed_text,
          chunkIndex,
          parentChunk.prev_chunk_id,
          parentChunk.next_chunk_id,
          JSON.stringify(parentChunk.headings),
          JSON.stringify(parentChunk.captions),
        ],
      )
    }
  }
}
