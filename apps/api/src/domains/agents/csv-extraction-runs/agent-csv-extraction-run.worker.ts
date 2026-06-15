import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import {
  AGENT_CSV_EXTRACTION_RUN_CONCURRENCY,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
} from "./agent-csv-extraction-run.constants"
import type { ProcessAgentCsvExtractionRunRecordJobPayload } from "./agent-csv-extraction-run.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunProcessorService } from "./agent-csv-extraction-run-processor.service"

@Processor(AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME, {
  maxStalledCount: 3,
  concurrency: AGENT_CSV_EXTRACTION_RUN_CONCURRENCY,
})
export class AgentCsvExtractionRunWorker extends WorkerHost {
  private readonly logger = new Logger(AgentCsvExtractionRunWorker.name)

  constructor(private readonly processorService: AgentCsvExtractionRunProcessorService) {
    super()
  }

  async process(job: Job<ProcessAgentCsvExtractionRunRecordJobPayload>): Promise<void> {
    await this.processorService.processRunRecord(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ProcessAgentCsvExtractionRunRecordJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ProcessAgentCsvExtractionRunRecordJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<ProcessAgentCsvExtractionRunRecordJobPayload> | undefined,
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
