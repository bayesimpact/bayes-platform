import { KNOWN_WORKER_QUEUE_NAMES } from "@/worker-pools"

const WORKERS_HEALTH_QUEUE_NAME_ENV = "WORKERS_HEALTH_QUEUE_NAME"

function resolveWorkersHealthQueueName(): string {
  const queueName = process.env[WORKERS_HEALTH_QUEUE_NAME_ENV]
  if (!queueName) {
    throw new Error(
      `${WORKERS_HEALTH_QUEUE_NAME_ENV} must be set to one of the queues this instance consumes. ` +
        `Valid queues: ${KNOWN_WORKER_QUEUE_NAMES.join(", ")}.`,
    )
  }

  if (!KNOWN_WORKER_QUEUE_NAMES.includes(queueName)) {
    throw new Error(
      `${WORKERS_HEALTH_QUEUE_NAME_ENV}="${queueName}" is not a known queue. ` +
        `Valid queues: ${KNOWN_WORKER_QUEUE_NAMES.join(", ")}.`,
    )
  }

  return queueName
}

export const WORKERS_HEALTH_QUEUE_NAME = resolveWorkersHealthQueueName()
