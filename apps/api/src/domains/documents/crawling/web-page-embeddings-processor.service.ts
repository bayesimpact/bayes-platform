import { Injectable, Logger } from "@nestjs/common"
import { Document as LlamaDocument, MetadataMode, SentenceSplitter } from "llamaindex"
import type { CreateDocumentEmbeddingsJobPayload } from "../embeddings/document-embeddings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingsSharedService } from "../embeddings/document-embeddings-shared.service"

const DOCUMENT_EMBEDDING_CHUNK_SIZE = 1024
const DOCUMENT_EMBEDDING_CHUNK_OVERLAP = 20
const MAX_EMBEDDING_ERROR_LENGTH = 2_000

function getEmbeddingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_EMBEDDING_ERROR_LENGTH)
}

@Injectable()
export class WebPageEmbeddingsProcessorService {
  private readonly logger = new Logger(WebPageEmbeddingsProcessorService.name)

  constructor(private readonly sharedService: DocumentEmbeddingsSharedService) {}

  async processDocument(payload: CreateDocumentEmbeddingsJobPayload): Promise<void> {
    const document = await this.sharedService.findDocumentOrThrow(payload)
    await this.sharedService.markDocumentStatus(document, "processing")

    try {
      const chunks = this.splitWebCrawlContent(document.content ?? "")
      this.logger.log(`Split document ${document.id} (from content) into ${chunks.length} chunks`)

      const embeddingsByModelName = await this.sharedService.generateEmbeddingsByModel(chunks)

      await this.sharedService.insertChunks({
        scope: {
          documentId: document.id,
          organizationId: payload.organizationId,
          projectId: payload.projectId,
        },
        chunks,
        embeddingsByModelName,
      })

      document.extractionEngine = "web-crawl"
      await this.sharedService.markDocumentStatus(document, "completed")

      this.logger.log(`Embeddings created for document ${document.id}`)
    } catch (error) {
      document.embeddingError = getEmbeddingErrorMessage(error)
      await this.sharedService.markDocumentStatus(document, "failed")
      throw error
    }
  }

  private splitWebCrawlContent(content: string): string[] {
    try {
      const pages: { url: string; markdown: string }[] = JSON.parse(content)
      return pages.flatMap((page) => this.splitTextForEmbeddings(page.markdown))
    } catch {
      return this.splitTextForEmbeddings(content)
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
