import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import {
  EVALUATION_EXTRACTION_RUN_CONCURRENCY,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./evaluation-extraction-run.constants"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunProcessorService } from "./evaluation-extraction-run-processor.service"

@Processor(EVALUATION_EXTRACTION_RUN_QUEUE_NAME, {
  maxStalledCount: 3, // Allow up to 3 stalls before giving up on the job
  concurrency: EVALUATION_EXTRACTION_RUN_CONCURRENCY,
})
export class EvaluationExtractionRunWorker extends WorkerHost {
  private readonly logger = new Logger(EvaluationExtractionRunWorker.name)

  constructor(private readonly processorService: EvaluationExtractionRunProcessorService) {
    super()
  }

  async process(job: Job<ProcessEvaluationExtractionRunRecordJobPayload>): Promise<void> {
    await this.processorService.processRunRecord(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ProcessEvaluationExtractionRunRecordJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ProcessEvaluationExtractionRunRecordJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<ProcessEvaluationExtractionRunRecordJobPayload> | undefined,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
    if (job) {
      await this.processorService.markRecordFailed(job.data, error)
    }
  }
}
