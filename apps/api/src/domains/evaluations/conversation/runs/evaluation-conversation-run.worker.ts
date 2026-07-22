import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import {
  EVALUATION_CONVERSATION_RUN_CONCURRENCY,
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
} from "./evaluation-conversation-run.constants"
import type { ProcessEvaluationConversationRunRecordJobPayload } from "./evaluation-conversation-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunProcessorService } from "./evaluation-conversation-run-processor.service"

@Processor(EVALUATION_CONVERSATION_RUN_QUEUE_NAME, {
  maxStalledCount: 3, // Allow up to 3 stalls before giving up on the job
  concurrency: EVALUATION_CONVERSATION_RUN_CONCURRENCY,
})
export class EvaluationConversationRunWorker extends WorkerHost {
  private readonly logger = new Logger(EvaluationConversationRunWorker.name)

  constructor(private readonly processorService: EvaluationConversationRunProcessorService) {
    super()
  }

  async process(job: Job<ProcessEvaluationConversationRunRecordJobPayload>): Promise<void> {
    await this.processorService.processRunRecord(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ProcessEvaluationConversationRunRecordJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ProcessEvaluationConversationRunRecordJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<ProcessEvaluationConversationRunRecordJobPayload> | undefined,
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
