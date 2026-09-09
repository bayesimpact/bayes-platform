const DEFAULT_DOCUMENT_EMBEDDINGS_QUEUE_NAME = "document-embeddings"

export const DOCUMENT_EMBEDDINGS_QUEUE_NAME =
  process.env.DOCUMENT_EMBEDDINGS_QUEUE_NAME ?? DEFAULT_DOCUMENT_EMBEDDINGS_QUEUE_NAME
export const DOCUMENT_EMBEDDINGS_JOB_NAME = "create-embeddings"

/** Max time to wait for BullMQ to accept a create-embeddings job before failing the document. */
export const DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS = 10_000

/** User-visible reason when the job could not be handed to the queue (Redis down, timeout). */
export const DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE =
  "Document could not be scheduled for processing. Please retry."
