import { randomUUID } from "node:crypto"
import { createVertex } from "@ai-sdk/google-vertex"
import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { embedMany } from "ai"
import { toSql } from "pgvector"
import type { DataSource } from "typeorm"
import type { DoclingChunk, DoclingParentChunk } from "@/external/docling/docling.types"
import type { SparseWeights } from "@/external/local-embeddings/local-embedding-bridge.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { LocalEmbeddingBridgeService } from "@/external/local-embeddings/local-embedding-bridge.service"
import { getLocalEmbeddingBatchSize } from "@/external/local-embeddings/local-embeddings.cli"
import { toSparseVectorSql } from "@/external/local-embeddings/sparse-weights"
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
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelRepository } from "./project-embedding-models/project-embedding-model.repository"

/** Vectors of one model for every chunk of a document; `sparse` only for models with a lexical head. */
export type ModelEmbeddings = {
  dense: number[][]
  sparse: SparseWeights[] | null
}

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
    private readonly projectEmbeddingModelRepository: ProjectEmbeddingModelRepository,
    private readonly localEmbeddingBridge: LocalEmbeddingBridgeService,
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

  /**
   * One vector per chunk for the Vertex models of the deployment, plus one per local model the
   * project enabled (so a new upload is retrievable with every model an agent may pick).
   */
  async generateEmbeddingsByModel({
    chunks,
    projectId,
  }: {
    chunks: string[]
    projectId: string
  }): Promise<Map<string, ModelEmbeddings>> {
    const embeddingsByModelName = await this.generateVertexEmbeddingsByModel(chunks)
    const localModelNames =
      await this.projectEmbeddingModelRepository.listActiveModelNames(projectId)
    for (const localModelName of localModelNames) {
      embeddingsByModelName.set(
        localModelName,
        await this.generateLocalEmbeddings({ modelName: localModelName, chunks }),
      )
    }
    return embeddingsByModelName
  }

  private async generateLocalEmbeddings({
    modelName,
    chunks,
  }: {
    modelName: string
    chunks: string[]
  }): Promise<ModelEmbeddings> {
    this.logger.log(`Creating embeddings with local model ${modelName}`)
    const batchSize = getLocalEmbeddingBatchSize()
    const dense: number[][] = []
    const sparse: SparseWeights[] = []
    let hasSparse = false
    for (let batchStartIndex = 0; batchStartIndex < chunks.length; batchStartIndex += batchSize) {
      const batch = await this.localEmbeddingBridge.embed({
        modelName,
        texts: chunks.slice(batchStartIndex, batchStartIndex + batchSize),
        inputType: "document",
      })
      dense.push(...batch.dense)
      if (batch.sparse) {
        hasSparse = true
        sparse.push(...batch.sparse)
      }
    }
    if (dense.length !== chunks.length || (hasSparse && sparse.length !== chunks.length)) {
      throw new Error(
        `Local model ${modelName} returned ${dense.length} vectors for ${chunks.length} chunks`,
      )
    }
    return { dense, sparse: hasSparse ? sparse : null }
  }

  private async generateVertexEmbeddingsByModel(
    chunks: string[],
  ): Promise<Map<string, ModelEmbeddings>> {
    const { project, location } = resolveVertexConfig()
    const embeddingModelNames = resolveEmbeddingModelNames()
    const maxVertexEmbeddingBatchSize = resolveMaxVertexEmbeddingBatchSize()
    this.logger.log(
      `Creating embeddings with Vertex models [${embeddingModelNames.join(", ")}] in project ${project}, location ${location}`,
    )

    const vertexProvider = createVertex({ project, location })
    const embeddingsByModelName = new Map<string, ModelEmbeddings>()
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

      embeddingsByModelName.set(embeddingModelName, { dense: embeddings, sparse: null })
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
    embeddingsByModelName: Map<string, ModelEmbeddings>
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
    embeddingsByModelName: Map<string, ModelEmbeddings>
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
    embeddingsByModelName: Map<string, ModelEmbeddings>
  }): Promise<void> {
    for (const [embeddingModelName, embeddings] of embeddingsByModelName.entries()) {
      // NOTE: raw SQL because TypeORM 0.3.28 does not support pgvector columns.
      await this.dataSource.query(
        `INSERT INTO document_chunk_embedding (id, created_at, updated_at, organization_id, project_id, document_chunk_id, model_name, embedding)
         VALUES (uuid_generate_v4(), now(), now(), $1, $2, $3, $4, $5::vector)
         ON CONFLICT (document_chunk_id, model_name) DO NOTHING`,
        [
          scope.organizationId,
          scope.projectId,
          chunkId,
          embeddingModelName,
          toSql(embeddings.dense[chunkIndex]),
        ],
      )
      const sparseEmbedding = toSparseVectorSql(embeddingModelName, embeddings.sparse?.[chunkIndex])
      if (sparseEmbedding !== null) {
        await this.dataSource.query(
          `INSERT INTO document_chunk_sparse_embedding (document_chunk_embedding_id, sparse_embedding)
           SELECT id, $3::sparsevec FROM document_chunk_embedding
           WHERE document_chunk_id = $1 AND model_name = $2
           ON CONFLICT (document_chunk_embedding_id) DO NOTHING`,
          [chunkId, embeddingModelName, sparseEmbedding],
        )
      }
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
