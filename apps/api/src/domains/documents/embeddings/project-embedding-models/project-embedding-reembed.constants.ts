const DEFAULT_PROJECT_EMBEDDING_REEMBED_QUEUE_NAME = "project-embedding-reembed"

export const PROJECT_EMBEDDING_REEMBED_QUEUE_NAME =
  process.env.PROJECT_EMBEDDING_REEMBED_QUEUE_NAME ?? DEFAULT_PROJECT_EMBEDDING_REEMBED_QUEUE_NAME
export const PROJECT_EMBEDDING_REEMBED_JOB_NAME = "reembed-project-chunks"

/** Max time to wait for BullMQ to accept the job before the request fails. */
export const PROJECT_EMBEDDING_REEMBED_ENQUEUE_TIMEOUT_MS = 10_000

export const PROJECT_EMBEDDING_REEMBED_ENQUEUE_FAILED_ERROR_MESSAGE =
  "The embedding model could not be scheduled for processing. Please retry."

/** Longest error text stored on the row; the full stack stays in the worker logs. */
export const MAX_PROJECT_EMBEDDING_MODEL_ERROR_LENGTH = 2_000
