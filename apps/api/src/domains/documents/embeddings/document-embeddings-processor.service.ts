import { randomUUID } from "node:crypto"
import { createVertex } from "@ai-sdk/google-vertex"
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { embedMany } from "ai"
import { Document as LlamaDocument, MetadataMode, SentenceSplitter } from "llamaindex"
import { toSql } from "pgvector"
import type { DataSource } from "typeorm"
import type { DoclingChunk, DoclingParentChunk } from "@/external/docling/docling.cli"
import type { Document } from "../document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "../storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import {
  resolveEmbeddingModelNames,
  resolveMaxVertexEmbeddingBatchSize,
  resolveVertexConfig,
} from "./document-embeddings.config"
import type { CreateDocumentEmbeddingsJobPayload } from "./document-embeddings.types"
import type { DocumentExtractionEngine } from "./document-text-extractor.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTextExtractorService } from "./document-text-extractor.service"

const DOCUMENT_EMBEDDING_CHUNK_SIZE = 1024
const DOCUMENT_EMBEDDING_CHUNK_OVERLAP = 20
const MAX_EMBEDDING_ERROR_LENGTH = 2_000

function getEmbeddingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_EMBEDDING_ERROR_LENGTH)
}

@Injectable()
export class DocumentEmbeddingsProcessorService {
  private readonly logger = new Logger(DocumentEmbeddingsProcessorService.name)

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly textExtractorService: DocumentTextExtractorService,
    private readonly embeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorage: IFileStorage,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async processDocument(payload: CreateDocumentEmbeddingsJobPayload): Promise<void> {
    const document = await this.findDocumentOrThrow(payload)
    await this.markDocumentStatus(document, "processing")

    try {
      const extractionResult = await this.extractDocumentChunks(document)
      const embeddingsByModelName = await this.generateEmbeddingsByModel(extractionResult.chunks)

      await this.insertChunks({
        scope: {
          documentId: document.id,
          organizationId: payload.organizationId,
          projectId: payload.projectId,
        },
        chunks: extractionResult.chunks,
        doclingChunks: extractionResult.doclingChunks,
        doclingParentChunks: extractionResult.doclingParentChunks,
        embeddingsByModelName,
      })

      document.extractionEngine = extractionResult.extractionEngine
      await this.markDocumentStatus(document, "completed")

      this.logger.log(`Embeddings created for document ${document.id}`)
    } catch (error) {
      document.embeddingError = getEmbeddingErrorMessage(error)
      await this.markDocumentStatus(document, "failed")
      throw error
    }
  }

  private async findDocumentOrThrow(
    payload: CreateDocumentEmbeddingsJobPayload,
  ): Promise<Document> {
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

  private async extractDocumentChunks(document: Document): Promise<{
    chunks: string[]
    doclingChunks?: DoclingChunk[]
    doclingParentChunks?: DoclingParentChunk[]
    extractionEngine: DocumentExtractionEngine
  }> {
    const fileBuffer = await this.fileStorage.readFile(document.storageRelativePath)
    const extractionResult = await this.textExtractorService.extract(fileBuffer, document.mimeType)
    const chunks = extractionResult.chunks ?? this.splitTextForEmbeddings(extractionResult.text)
    this.logger.log(`Split document ${document.id} into ${chunks.length} chunks`)
    return {
      chunks,
      doclingChunks: extractionResult.doclingChunks,
      doclingParentChunks: extractionResult.doclingParentChunks,
      extractionEngine: extractionResult.extractionEngine,
    }
  }

  private splitTextForEmbeddings(text: string): string[] {
    const sentenceSplitter = new SentenceSplitter({
      chunkSize: DOCUMENT_EMBEDDING_CHUNK_SIZE,
      chunkOverlap: DOCUMENT_EMBEDDING_CHUNK_OVERLAP,
    })
    const rootDocument = new LlamaDocument({ text })
    return sentenceSplitter
      .getNodesFromDocuments([rootDocument])
      .map((textNode) => textNode.getContent(MetadataMode.NONE).trim())
      .filter((chunk) => chunk.length > 0)
  }

  private async generateEmbeddingsByModel(chunks: string[]): Promise<Map<string, number[][]>> {
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

  private async markDocumentStatus(
    document: Document,
    status: Document["embeddingStatus"],
  ): Promise<void> {
    document.embeddingStatus = status
    if (status === "processing" || status === "completed") {
      document.embeddingError = null
    }
    await this.saveDocumentAndNotify(document)
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

  private async insertChunks({
    scope,
    chunks,
    doclingChunks,
    doclingParentChunks,
    embeddingsByModelName,
  }: {
    scope: { documentId: string; organizationId: string; projectId: string }
    chunks: string[]
    doclingChunks?: DoclingChunk[]
    doclingParentChunks?: DoclingParentChunk[]
    embeddingsByModelName: Map<string, number[][]>
  }): Promise<void> {
    const { documentId, organizationId, projectId } = scope
    // Embeddings are cascade-deleted from document_chunk_embedding.
    await Promise.all([
      this.dataSource.query(`DELETE FROM document_chunk WHERE document_id = $1`, [documentId]),
      this.dataSource.query(`DELETE FROM document_parent_chunk WHERE document_id = $1`, [
        documentId,
      ]),
    ])

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const doclingChunk = doclingChunks?.[chunkIndex]
      const chunkId = doclingChunk?.chunk_id ?? randomUUID()
      const content = doclingChunk?.text ?? chunks[chunkIndex]
      const embedText = chunks[chunkIndex]
      const parentId = doclingChunk?.parent_id ?? null
      const prevChunkId = doclingChunk?.prev_chunk_id ?? null
      const nextChunkId = doclingChunk?.next_chunk_id ?? null
      const headings = JSON.stringify(doclingChunk?.headings ?? [])
      const captions = JSON.stringify(doclingChunk?.captions ?? [])

      await this.dataSource.query(
        `INSERT INTO document_chunk (id, created_at, updated_at, organization_id, project_id, document_id, content, embed_text, chunk_index, parent_id, prev_chunk_id, next_chunk_id, headings, captions)
         VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          chunkId,
          organizationId,
          projectId,
          documentId,
          content,
          embedText,
          chunkIndex,
          parentId,
          prevChunkId,
          nextChunkId,
          headings,
          captions,
        ],
      )

      for (const [embeddingModelName, embeddings] of embeddingsByModelName.entries()) {
        // NOTE: We need to use raw SQL here because TypeORM doesn't support vector columns (at least in the current 0.3.28 version)
        await this.dataSource.query(
          `INSERT INTO document_chunk_embedding (id, created_at, updated_at, organization_id, project_id, document_chunk_id, model_name, embedding)
           VALUES (uuid_generate_v4(), now(), now(), $1, $2, $3, $4, $5::vector)`,
          [organizationId, projectId, chunkId, embeddingModelName, toSql(embeddings[chunkIndex])],
        )
      }
    }

    if (doclingParentChunks) {
      for (const [chunkIndex, parentChunk] of doclingParentChunks.entries()) {
        await this.dataSource.query(
          `INSERT INTO document_parent_chunk (id, created_at, updated_at, organization_id, project_id, document_id, content, embed_text, chunk_index, prev_chunk_id, next_chunk_id, headings, captions)
           VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            parentChunk.chunk_id,
            organizationId,
            projectId,
            documentId,
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
}
