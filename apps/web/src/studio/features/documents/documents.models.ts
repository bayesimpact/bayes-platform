import type { DocumentDto } from "@caseai-connect/api-contracts"

export type Document = DocumentDto

// Web-local event shape used after mapping from API DTO stream events.
export type DocumentEmbeddingStatusChangedEvent = {
  documentId: string
  embeddingStatus: Document["embeddingStatus"]
  embeddingError: Document["embeddingError"]
  updatedAt: number
}
