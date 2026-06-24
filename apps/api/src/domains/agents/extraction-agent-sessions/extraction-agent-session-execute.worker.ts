import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { EXTRACTION_AGENT_SESSION_QUEUE_NAME } from "./extraction-agent-session.constants"
import type { ExecuteExtractionAgentSessionJobPayload } from "./extraction-agent-session.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionRunnerService } from "./extraction-agent-session-runner.service"

@Processor(EXTRACTION_AGENT_SESSION_QUEUE_NAME)
export class ExtractionAgentSessionExecuteWorker extends WorkerHost {
  private readonly logger = new Logger(ExtractionAgentSessionExecuteWorker.name)

  constructor(private readonly runnerService: ExtractionAgentSessionRunnerService) {
    super()
  }

  async process(job: Job<ExecuteExtractionAgentSessionJobPayload>): Promise<void> {
    await this.runnerService.runById(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ExecuteExtractionAgentSessionJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ExecuteExtractionAgentSessionJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ExecuteExtractionAgentSessionJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
