import type { DocumentEmbeddingStatus } from "@caseai-connect/api-contracts"

export type CreateDocumentEmbeddingsJobPayload = {
  documentId: string
  organizationId: string
  projectId: string
  uploadedByUserId: string
  origin: "document-upload"
  currentTraceId: string
}

/** Fields persisted when a document is marked queued after enqueue (for in-memory DTO sync). */
export type DocumentEmbeddingAfterEnqueuePatch = {
  embeddingStatus: DocumentEmbeddingStatus
  embeddingError: string | null
  updatedAt: Date
}
