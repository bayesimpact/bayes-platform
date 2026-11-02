import type { Job } from "bullmq"

const MAX_CAUSE_LENGTH = 300

/**
 * The part of a failed job's log message after "Job failed: ", for example
 * `create-embeddings: PermissionError: [Errno 13] Permission denied (job 2350)`.
 *
 * The cause comes first and the job id last, so that the errors of one cause read alike when the
 * logs are grouped by message, as an error log alert does. The stack still goes to the log entry
 * as its own field.
 */
export function describeFailedJob(job: Job | undefined, error: Error): string {
  const firstLine = error.message.split("\n", 1)[0]?.trim()
  const cause = (firstLine || error.name).slice(0, MAX_CAUSE_LENGTH)
  return `${job?.name ?? "unknown"}: ${cause} (job ${job?.id ?? "unknown"})`
}
