import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_JOB_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME,
} from "./agent-csv-extraction-run.constants"
import type {
  ExecuteAgentCsvExtractionRunJobPayload,
  ProcessAgentCsvExtractionRunRecordJobPayload,
} from "./agent-csv-extraction-run.types"

@Injectable()
export class BullMqAgentCsvExtractionRunBatchService {
  private readonly logger = new Logger(BullMqAgentCsvExtractionRunBatchService.name)

  constructor(
    @InjectQueue(AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME)
    private readonly executeQueue: Queue<ExecuteAgentCsvExtractionRunJobPayload>,
    @InjectQueue(AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME)
    private readonly recordQueue: Queue<ProcessAgentCsvExtractionRunRecordJobPayload>,
  ) {}

  async enqueueExecuteRun(payload: ExecuteAgentCsvExtractionRunJobPayload): Promise<void> {
    this.logger.log(
      `Enqueuing execute run job (agentCsvExtractionRunId=${payload.agentCsvExtractionRunId})`,
    )
    await this.executeQueue.add(AGENT_CSV_EXTRACTION_RUN_JOB_NAME, payload, {
      jobId: `execute-run-${payload.agentCsvExtractionRunId}`,
    })
  }

  async enqueueRunRecords(payloads: ProcessAgentCsvExtractionRunRecordJobPayload[]): Promise<void> {
    if (payloads.length === 0) return
    this.logger.log(
      `Enqueuing ${payloads.length} agent CSV run record jobs (agentCsvExtractionRunId=${payloads[0]?.agentCsvExtractionRun.id})`,
    )
    await this.recordQueue.addBulk(
      payloads.map((payload) => ({
        name: AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME,
        data: payload,
        opts: { jobId: payload.runRecordId },
      })),
    )
  }

  async retryRunRecords(payloads: ProcessAgentCsvExtractionRunRecordJobPayload[]): Promise<void> {
    for (const payload of payloads) {
      const job = await this.recordQueue.getJob(payload.runRecordId)
      if (!job) {
        await this.recordQueue.add(AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME, payload, {
          jobId: payload.runRecordId,
        })
        continue
      }
      const state = await job.getState()
      if (state === "failed") {
        await job.retry()
      }
    }
  }

  async removePendingRunRecords(runRecordIds: string[]): Promise<void> {
    for (const runRecordId of runRecordIds) {
      const job = await this.recordQueue.getJob(runRecordId)
      if (!job) continue

      const state = await job.getState()
      if (state === "active") {
        this.logger.log(
          `Job Agent CSV Run Record with id "${runRecordId}" is active — relying on cooperative cancel in processor`,
        )
        continue
      }

      try {
        await job.remove()
      } catch (error) {
        this.logger.warn(
          `Failed to remove job Agent CSV Run Record with id "${runRecordId}" (state=${state}): ${error instanceof Error ? error.message : error}`,
        )
      }
    }
  }
}
