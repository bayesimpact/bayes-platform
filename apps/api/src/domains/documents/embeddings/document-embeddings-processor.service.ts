import { Inject, Injectable, Logger } from "@nestjs/common"
import { Document as LlamaDocument, MetadataMode, SentenceSplitter } from "llamaindex"
import type { Document } from "../document.entity"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "../storage/file-storage.interface"
import type { CreateDocumentEmbeddingsJobPayload } from "./document-embeddings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"
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
    private readonly sharedService: DocumentEmbeddingsSharedService,
    private readonly textExtractorService: DocumentTextExtractorService,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorage: IFileStorage,
  ) {}

  async processDocument(payload: CreateDocumentEmbeddingsJobPayload): Promise<void> {
    const document = await this.sharedService.findDocumentOrThrow(payload)
    await this.sharedService.markDocumentStatus(document, "processing")

    try {
      const extractionResult = await this.extractDocumentChunks(document)
      const embeddingsByModelName = await this.sharedService.generateEmbeddingsByModel(
        extractionResult.chunks,
      )

      await this.sharedService.insertChunks({
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
      await this.sharedService.markDocumentStatus(document, "completed")

      this.logger.log(`Embeddings created for document ${document.id}`)
    } catch (error) {
      document.embeddingError = getEmbeddingErrorMessage(error)
      await this.sharedService.markDocumentStatus(document, "failed")
      throw error
    }
  }

  // `chunks` is the array of strings sent to the embedding API (embed_text).
  // `doclingChunks` is the index-aligned array of rich Docling objects carrying
  // chunk_id, parent_id, prev/next, headings — used only when building the DB row.
  // `doclingChunks` is undefined for paths that don't go through Docling (the
  // SentenceSplitter fallback in splitTextForEmbeddings); in that case
  // insertChildChunkRow falls back to randomUUID() and null relationships.
  private async extractDocumentChunks(document: Document): Promise<{
    chunks: string[]
    doclingChunks?: import("@/external/docling/docling.types").DoclingChunk[]
    doclingParentChunks?: import("@/external/docling/docling.types").DoclingParentChunk[]
    extractionEngine: DocumentExtractionEngine
  }> {
    const fileBuffer = await this.fileStorage.readFile(document.storageRelativePath)
    const extractionResult = await this.textExtractorService.extract(
      fileBuffer,
      document.mimeType,
    )
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
}
