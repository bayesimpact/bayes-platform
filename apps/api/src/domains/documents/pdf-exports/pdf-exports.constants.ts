const PDF_EXPORTS_SWEEP_QUEUE_NAME_ENV = "PDF_EXPORTS_SWEEP_QUEUE_NAME"

/**
 * The queue name has no default: every worker process must declare it, so the
 * value a pool consumes (`WORKER_QUEUE_NAMES`) and the value the module
 * registers can never drift apart silently.
 */
export function resolvePdfExportsSweepQueueName(): string {
  const queueName = process.env[PDF_EXPORTS_SWEEP_QUEUE_NAME_ENV]
  if (!queueName) {
    throw new Error(
      `${PDF_EXPORTS_SWEEP_QUEUE_NAME_ENV} must be set (for example "pdf-exports-sweep") on every worker process.`,
    )
  }
  return queueName
}

export const PDF_EXPORTS_SWEEP_QUEUE_NAME = resolvePdfExportsSweepQueueName()

export const PDF_EXPORTS_SWEEP_JOB_NAME = "sweep-expired-pdf-exports"

export const PDF_EXPORTS_SWEEP_SCHEDULER_ID = "pdf-exports-sweep"

/** Objects listed per GCS page. */
export const PDF_EXPORTS_SWEEP_PAGE_SIZE = 1000

/** Upper bound on the pages listed per run, so one sweep cannot run unbounded. */
export const PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN = 20

/**
 * Extra delay past the expiry before an object is deleted, so a download that
 * starts in the last second of a signed URL's lifetime still completes.
 */
export const PDF_EXPORTS_DELETE_GRACE_SECONDS = 60

/** Number of deletes issued concurrently. */
export const PDF_EXPORTS_DELETE_CHUNK_SIZE = 20

/** DI token for the bucket holding temporary PDF exports (null when GCS is not configured). */
export const PDF_EXPORTS_BUCKET = "PdfExportsBucket"
