import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  PROJECT_EMBEDDING_REEMBED_ENQUEUE_FAILED_ERROR_MESSAGE,
  PROJECT_EMBEDDING_REEMBED_ENQUEUE_TIMEOUT_MS,
  PROJECT_EMBEDDING_REEMBED_JOB_NAME,
  PROJECT_EMBEDDING_REEMBED_QUEUE_NAME,
} from "./project-embedding-reembed.constants"
import type { ReembedProjectChunksJobPayload } from "./project-embedding-reembed.types"
import type { ProjectEmbeddingReembedBatchService } from "./project-embedding-reembed-batch.interface"

@Injectable()
export class BullMqProjectEmbeddingReembedBatchService
  implements ProjectEmbeddingReembedBatchService
{
  private readonly logger = new Logger(BullMqProjectEmbeddingReembedBatchService.name)

  constructor(
    @InjectQueue(PROJECT_EMBEDDING_REEMBED_QUEUE_NAME)
    private readonly queue: Queue<ReembedProjectChunksJobPayload>,
  ) {}

  /**
   * Bounded like the document embeddings enqueue: with Redis down, `queue.add` would hang
   * through the ioredis reconnect retries well past any HTTP timeout.
   */
  async enqueueReembedProjectChunks(payload: ReembedProjectChunksJobPayload): Promise<void> {
    this.logger.log(`Enqueuing re-embedding job ${JSON.stringify(payload)}`)
    let timeoutHandle: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${PROJECT_EMBEDDING_REEMBED_ENQUEUE_TIMEOUT_MS}ms waiting for the queue to accept the job`,
          ),
        )
      }, PROJECT_EMBEDDING_REEMBED_ENQUEUE_TIMEOUT_MS)
    })
    try {
      await Promise.race([
        this.queue.add(PROJECT_EMBEDDING_REEMBED_JOB_NAME, payload, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        }),
        timeoutPromise,
      ])
    } catch (enqueueError) {
      this.logger.error(
        `Failed to enqueue re-embedding job for project embedding model ${payload.projectEmbeddingModelId}: ${
          enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
        }`,
      )
      throw new ServiceUnavailableException(PROJECT_EMBEDDING_REEMBED_ENQUEUE_FAILED_ERROR_MESSAGE)
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }
}
