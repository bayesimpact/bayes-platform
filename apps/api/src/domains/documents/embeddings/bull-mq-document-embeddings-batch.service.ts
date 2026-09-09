import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import type { Queue } from "bullmq"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingQueueSyncService } from "./document-embedding-queue-sync.service"
import {
  DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE,
  DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS,
  DOCUMENT_EMBEDDINGS_JOB_NAME,
  DOCUMENT_EMBEDDINGS_QUEUE_NAME,
} from "./document-embeddings.constants"
import type {
  CreateDocumentEmbeddingsJobPayload,
  DocumentEmbeddingAfterEnqueuePatch,
} from "./document-embeddings.types"

@Injectable()
export class BullMqDocumentEmbeddingsBatchService {
  private readonly logger = new Logger(BullMqDocumentEmbeddingsBatchService.name)

  constructor(
    @InjectQueue(DOCUMENT_EMBEDDINGS_QUEUE_NAME)
    private readonly documentEmbeddingsQueue: Queue<CreateDocumentEmbeddingsJobPayload>,
    private readonly documentEmbeddingQueueSyncService: DocumentEmbeddingQueueSyncService,
  ) {}

  /**
   * Hands the job to BullMQ, then marks the document `queued`.
   *
   * If Redis is unreachable, `queue.add` would otherwise hang through ioredis' reconnect
   * retries (well past any HTTP timeout) and leave the document `pending`, a state the stuck
   * sweep does not cover and the reprocess action refuses. So the add is bounded, and on
   * failure the document is marked `failed` before a 503 is thrown to the caller.
   */
  async enqueueCreateEmbeddingsForDocument(
    payload: CreateDocumentEmbeddingsJobPayload,
  ): Promise<DocumentEmbeddingAfterEnqueuePatch> {
    this.logger.log(`Enqueuing document embeddings job ${JSON.stringify(payload)}`)
    try {
      await this.addJobWithTimeout(payload)
    } catch (enqueueError) {
      this.logger.error(
        `Failed to enqueue document embeddings job for document ${payload.documentId}: ${
          enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
        }`,
      )
      await this.markAsEnqueueFailedBestEffort(payload)
      throw new ServiceUnavailableException(DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE)
    }

    return await this.documentEmbeddingQueueSyncService.markDocumentAsQueuedAndNotify(payload)
  }

  private async addJobWithTimeout(payload: CreateDocumentEmbeddingsJobPayload): Promise<void> {
    let timeoutHandle: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS}ms waiting for the queue to accept the job`,
          ),
        )
      }, DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS)
    })
    try {
      await Promise.race([
        this.documentEmbeddingsQueue.add(DOCUMENT_EMBEDDINGS_JOB_NAME, payload),
        timeoutPromise,
      ])
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }

  /** The original enqueue error is what the caller must see, so a DB failure here is only logged. */
  private async markAsEnqueueFailedBestEffort(
    payload: CreateDocumentEmbeddingsJobPayload,
  ): Promise<void> {
    try {
      await this.documentEmbeddingQueueSyncService.markDocumentAsEnqueueFailedAndNotify(payload)
    } catch (markError) {
      this.logger.error(
        `Could not mark document ${payload.documentId} as failed after enqueue error: ${
          markError instanceof Error ? markError.message : String(markError)
        }`,
      )
    }
  }
}
