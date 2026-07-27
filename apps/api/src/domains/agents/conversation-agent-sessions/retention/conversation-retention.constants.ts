const DEFAULT_CONVERSATION_RETENTION_SWEEP_QUEUE_NAME = "conversation-retention-sweep"

export const CONVERSATION_RETENTION_SWEEP_QUEUE_NAME =
  process.env.CONVERSATION_RETENTION_SWEEP_QUEUE_NAME ??
  DEFAULT_CONVERSATION_RETENTION_SWEEP_QUEUE_NAME

export const CONVERSATION_RETENTION_SWEEP_JOB_NAME = "sweep-expired-conversations"

export const CONVERSATION_RETENTION_SWEEP_SCHEDULER_ID = "conversation-retention-sweep"

/** Sessions fetched per batch; the sweep loops until drained. */
export const CONVERSATION_RETENTION_SWEEP_BATCH_LIMIT = 200

/** Safety cap on batches per run (200 x 100 = 20k sessions); leftovers wait for the next run. */
export const CONVERSATION_RETENTION_SWEEP_MAX_BATCHES_PER_RUN = 100
