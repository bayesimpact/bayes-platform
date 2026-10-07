import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common"
import { type Queue, QueueEvents } from "bullmq"
import { getBullMqConnection } from "@/bullmq.config"
import { readPositiveIntEnv } from "@/config/positive-int-env"
import {
  QUERY_EMBEDDINGS_JOB_NAME,
  QUERY_EMBEDDINGS_QUEUE_NAME,
} from "./query-embeddings.constants"
import type { EmbedQueryJobPayload, EmbedQueryJobResult } from "./query-embeddings.types"

const DEFAULT_LOCAL_EMBEDDING_QUERY_TIMEOUT_MS = 15_000

/** How long a chat turn waits for the GPU workers to embed the query before falling back. */
export function getLocalEmbeddingQueryTimeoutMs(): number {
  return readPositiveIntEnv("LOCAL_EMBEDDING_QUERY_TIMEOUT_MS", {
    defaultValue: DEFAULT_LOCAL_EMBEDDING_QUERY_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

/**
 * Request/response over BullMQ: the API adds a job and waits for its return value. Redis is the
 * only channel the API and the GPU workers share, so no new network path is needed.
 */
@Injectable()
export class BullMqQueryEmbeddingsClientService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMqQueryEmbeddingsClientService.name)
  private queueEvents: QueueEvents | null = null

  constructor(
    @InjectQueue(QUERY_EMBEDDINGS_QUEUE_NAME)
    private readonly queue: Queue<EmbedQueryJobPayload, EmbedQueryJobResult>,
  ) {}

  async embedQuery(payload: EmbedQueryJobPayload): Promise<EmbedQueryJobResult> {
    const timeoutMs = getLocalEmbeddingQueryTimeoutMs()
    const job = await this.queue.add(QUERY_EMBEDDINGS_JOB_NAME, payload, {
      removeOnComplete: true,
      removeOnFail: true,
    })
    const result = await job.waitUntilFinished(this.getQueueEvents(), timeoutMs)
    if (!Array.isArray(result?.embedding)) {
      throw new Error(`Query embedding job ${job.id} returned no vector`)
    }
    return { embedding: result.embedding, sparseEmbedding: result.sparseEmbedding ?? null }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queueEvents) {
      await this.queueEvents.close().catch(() => undefined)
      this.queueEvents = null
    }
  }

  private getQueueEvents(): QueueEvents {
    if (!this.queueEvents) {
      this.logger.log(`Listening to ${QUERY_EMBEDDINGS_QUEUE_NAME} queue events`)
      this.queueEvents = new QueueEvents(QUERY_EMBEDDINGS_QUEUE_NAME, {
        connection: getBullMqConnection(),
      })
    }
    return this.queueEvents
  }
}
