import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME } from "./document-embeddings-stuck.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingsStuckSweepService } from "./document-embeddings-stuck-sweep.service"

@Processor(DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME)
export class DocumentEmbeddingsStuckSweepWorker extends WorkerHost {
  private readonly logger = new Logger(DocumentEmbeddingsStuckSweepWorker.name)

  constructor(private readonly stuckSweepService: DocumentEmbeddingsStuckSweepService) {
    super()
  }

  async process(_job: Job): Promise<void> {
    const { timedOutCount } = await this.stuckSweepService.sweepStuckDocuments()
    this.logger.log(`Stuck embedding sweep finished (${timedOutCount} document(s) timed out).`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
