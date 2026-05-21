import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./document-embeddings.constants"
import type { CreateDocumentEmbeddingsJobPayload } from "./document-embeddings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingsProcessorService } from "./document-embeddings-processor.service"

@Processor(DOCUMENT_EMBEDDINGS_QUEUE_NAME)
export class DocumentEmbeddingsWorker extends WorkerHost {
  private readonly logger = new Logger(DocumentEmbeddingsWorker.name)

  constructor(private readonly embeddingsProcessorService: DocumentEmbeddingsProcessorService) {
    super()
  }

  async process(job: Job<CreateDocumentEmbeddingsJobPayload>): Promise<void> {
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
