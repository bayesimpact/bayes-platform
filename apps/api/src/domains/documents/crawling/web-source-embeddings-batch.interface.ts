import type { CreateDocumentEmbeddingsJobPayload } from "../embeddings/document-embeddings.types"

export const WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE = "WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE"

export interface WebSourceEmbeddingsBatchService {
  enqueueCreateEmbeddingsForDocument(payload: CreateDocumentEmbeddingsJobPayload): Promise<void>
}
