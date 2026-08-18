import type { Document } from "../document.entity"
import { DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE } from "./document-embeddings.constants"
import {
  DOCUMENT_EMBEDDINGS_STUCK_CRAWL_TIMEOUT_ERROR_MESSAGE,
  DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE,
} from "./document-embeddings-stuck.constants"

export function getStuckSweepEmbeddingErrorMessage(
  document: Pick<Document, "embeddingStatus" | "sourceType">,
): string {
  if (document.embeddingStatus !== "pending") {
    return DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE
  }
  if (document.sourceType === "webCrawl") {
    return DOCUMENT_EMBEDDINGS_STUCK_CRAWL_TIMEOUT_ERROR_MESSAGE
  }
  return DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE
}
