import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME } from "./agent-csv-extraction-run.constants"
import type { ExecuteAgentCsvExtractionRunJobPayload } from "./agent-csv-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunStarterService } from "./agent-csv-extraction-run-starter.service"

@Processor(AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME)
export class AgentCsvExtractionRunExecuteWorker extends WorkerHost {
  private readonly logger = new Logger(AgentCsvExtractionRunExecuteWorker.name)

  constructor(private readonly starterService: AgentCsvExtractionRunStarterService) {
    super()
  }

  async process(job: Job<ExecuteAgentCsvExtractionRunJobPayload>): Promise<void> {
    await this.starterService.startRun(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ExecuteAgentCsvExtractionRunJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ExecuteAgentCsvExtractionRunJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ExecuteAgentCsvExtractionRunJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
