const DEFAULT_DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME = "document-embeddings-stuck-sweep"

export const DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME =
  process.env.DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME ??
  DEFAULT_DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME

export const DOCUMENT_EMBEDDINGS_STUCK_SWEEP_JOB_NAME = "sweep-stuck-embeddings"

export const DOCUMENT_EMBEDDINGS_STUCK_SWEEP_SCHEDULER_ID = "document-embeddings-stuck-sweep"

/** User-visible reason when a document stays queued or processing too long. */
export const DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE =
  "Document embedding did not complete within the allowed time."

/** User-visible reason when a web crawl stays pending past the stuck threshold. */
export const DOCUMENT_EMBEDDINGS_STUCK_CRAWL_TIMEOUT_ERROR_MESSAGE =
  "Website crawl did not complete within the allowed time."

export const DOCUMENT_EMBEDDINGS_STUCK_SWEEP_BATCH_LIMIT = 500
