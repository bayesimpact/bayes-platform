import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME } from "./evaluation-extraction-run.constants"
import type { ExecuteEvaluationExtractionRunJobPayload } from "./evaluation-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStarterService } from "./evaluation-extraction-run-starter.service"

@Processor(EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME)
export class EvaluationExtractionRunExecuteWorker extends WorkerHost {
  private readonly logger = new Logger(EvaluationExtractionRunExecuteWorker.name)

  constructor(private readonly starterService: EvaluationExtractionRunStarterService) {
    super()
  }

  async process(job: Job<ExecuteEvaluationExtractionRunJobPayload>): Promise<void> {
    await this.starterService.startRun(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ExecuteEvaluationExtractionRunJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ExecuteEvaluationExtractionRunJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ExecuteEvaluationExtractionRunJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
