import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { describeFailedJob } from "@/common/logger/describe-failed-job"
import { EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME } from "./evaluation-conversation-run.constants"
import type { ExecuteEvaluationConversationRunJobPayload } from "./evaluation-conversation-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunStarterService } from "./evaluation-conversation-run-starter.service"

@Processor(EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME)
export class EvaluationConversationRunExecuteWorker extends WorkerHost {
  private readonly logger = new Logger(EvaluationConversationRunExecuteWorker.name)

  constructor(private readonly starterService: EvaluationConversationRunStarterService) {
    super()
  }

  async process(job: Job<ExecuteEvaluationConversationRunJobPayload>): Promise<void> {
    await this.starterService.startRun(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ExecuteEvaluationConversationRunJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ExecuteEvaluationConversationRunJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ExecuteEvaluationConversationRunJobPayload> | undefined, error: Error): void {
    this.logger.error(`Job failed: ${describeFailedJob(job, error)}`, error.stack)
  }
}
