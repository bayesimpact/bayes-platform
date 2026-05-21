import type { DocumentSourceType } from "@caseai-connect/api-contracts"
import type { DocumentTagsUpdateFields } from "@/studio/features/document-tags/document-tags.models"
import type {
  Document,
  DocumentCrawlProgressEvent,
  DocumentEmbeddingStatusChangedEvent,
} from "./documents.models"

export interface IDocumentsSpi {
  getAll(params: {
    organizationId: string
    projectId: string
    sourceType: DocumentSourceType
  }): Promise<Document[]>
  listMyExtractionDocuments(params: {
    organizationId: string
    projectId: string
  }): Promise<Document[]>
  uploadOne(params: {
    organizationId: string
    projectId: string
    file: File
    sourceType: DocumentSourceType
    tagIds?: string[]
  }): Promise<Document>
  uploadMany(params: {
    organizationId: string
    projectId: string
    files: File[]
    sourceType: DocumentSourceType
    tagIds?: string[]
    onFileProcessed: (
      result:
        | { file: File; status: "success"; document: Document }
        | { file: File; status: "error"; error: Error },
    ) => void
  }): Promise<void>
  updateOne(params: {
    organizationId: string
    projectId: string
    documentId: string
    payload: Partial<Pick<Document, "title">> & DocumentTagsUpdateFields
  }): Promise<void>
  reprocessOne(params: {
    organizationId: string
    projectId: string
    documentId: string
  }): Promise<void>
  deleteOne(params: {
    organizationId: string
    projectId: string
    documentId: string
  }): Promise<void>
  getTemporaryUrl(params: {
    organizationId: string
    projectId: string
    documentId: string
  }): Promise<{ url: string }>
  streamEmbeddingStatus(params: {
    organizationId: string
    projectId: string
    signal?: AbortSignal
    onStatusChanged: (event: DocumentEmbeddingStatusChangedEvent) => void
  }): Promise<void>
  streamCrawlProgress(params: {
    organizationId: string
    projectId: string
    signal?: AbortSignal
    onProgressChanged: (event: DocumentCrawlProgressEvent) => void
  }): Promise<void>
  crawlUrl(params: {
    organizationId: string
    projectId: string
    url: string
    name?: string
  }): Promise<{ message: string }>
  reCrawlUrl(params: {
    organizationId: string
    projectId: string
    documentId: string
  }): Promise<{ message: string }>
}
