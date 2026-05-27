import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import type { CreateDocumentEmbeddingsJobPayload } from "../embeddings/document-embeddings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingsProcessorService } from "../embeddings/document-embeddings-processor.service"
import {
  WEB_SOURCE_EMBEDDINGS_JOB_NAME,
  WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
} from "./web-source-embeddings.constants"

@Processor(WEB_SOURCE_EMBEDDINGS_QUEUE_NAME)
export class WebSourceEmbeddingsWorker extends WorkerHost {
  private readonly logger = new Logger(WebSourceEmbeddingsWorker.name)

  constructor(private readonly embeddingsProcessorService: DocumentEmbeddingsProcessorService) {
    super()
  }

  async process(job: Job<CreateDocumentEmbeddingsJobPayload>): Promise<void> {
    if (job.name !== WEB_SOURCE_EMBEDDINGS_JOB_NAME) {
      return
    }

    await this.embeddingsProcessorService.processDocument(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<CreateDocumentEmbeddingsJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<CreateDocumentEmbeddingsJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<CreateDocumentEmbeddingsJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
