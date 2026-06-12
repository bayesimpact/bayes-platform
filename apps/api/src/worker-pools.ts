import {
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
} from "./domains/agents/csv-extraction-runs/agent-csv-extraction-run.constants"
import { URL_CRAWLING_QUEUE_NAME } from "./domains/documents/crawling/url-crawling.constants"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./domains/documents/crawling/web-source-embeddings.constants"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./domains/documents/embeddings/document-embeddings.constants"
import { DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME } from "./domains/documents/embeddings/document-embeddings-stuck.constants"
import {
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./domains/evaluations/extraction/runs/evaluation-extraction-run.constants"

/**
 * Every queue a worker process can consume. Built from the queue-name
 * constants (not literals) so a deployment overriding a queue name keeps this
 * list in sync with the modules that register the queues.
 */
export const KNOWN_WORKER_QUEUE_NAMES: readonly string[] = [
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  URL_CRAWLING_QUEUE_NAME,
  DOCUMENT_EMBEDDINGS_QUEUE_NAME,
  DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME,
  WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
]

export const WORKER_QUEUE_NAMES_ENV = "WORKER_QUEUE_NAMES"

/**
 * Parse the comma-separated list of queue names this instance should consume,
 * supplied via the `WORKER_QUEUE_NAMES` env var. Production runs two instance
 * types (GPU / CPU); each sets this var to the subset of queues it owns.
 *
 * Fails fast (throws) when the var is missing/empty or names an unknown queue,
 * so a misconfigured instance never silently consumes the wrong queues.
 */
export function parseEnabledWorkerQueueNames(): string[] {
  const rawValue = process.env[WORKER_QUEUE_NAMES_ENV]
  const queueNames = (rawValue ?? "")
    .split(",")
    .map((queueName) => queueName.trim())
    .filter((queueName) => queueName.length > 0)

  if (queueNames.length === 0) {
    throw new Error(
      `${WORKER_QUEUE_NAMES_ENV} must be set to a comma-separated list of queue names. ` +
        `Valid queues: ${KNOWN_WORKER_QUEUE_NAMES.join(", ")}.`,
    )
  }

  const unknownQueueNames = queueNames.filter(
    (queueName) => !KNOWN_WORKER_QUEUE_NAMES.includes(queueName),
  )
  if (unknownQueueNames.length > 0) {
    throw new Error(
      `${WORKER_QUEUE_NAMES_ENV} contains unknown queue names: ${unknownQueueNames.join(", ")}. ` +
        `Valid queues: ${KNOWN_WORKER_QUEUE_NAMES.join(", ")}.`,
    )
  }

  return queueNames
}
