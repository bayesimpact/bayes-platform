import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
} from "./evaluation-extraction-run.constants"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"

@Injectable()
export class BullMqEvaluationExtractionRunBatchService {
  private readonly logger = new Logger(BullMqEvaluationExtractionRunBatchService.name)

  constructor(
    @InjectQueue(EVALUATION_EXTRACTION_RUN_QUEUE_NAME)
    private readonly evaluationExtractionRunQueue: Queue<ProcessEvaluationExtractionRunRecordJobPayload>,
  ) {}

  async enqueueRunRecords(
    payloads: ProcessEvaluationExtractionRunRecordJobPayload[],
  ): Promise<void> {
    if (payloads.length === 0) return
    this.logger.log(
      `Enqueuing ${payloads.length} evaluation run record jobs (evaluationExtractionRunId=${payloads[0]?.evaluationExtractionRun.id})`,
    )
    await this.evaluationExtractionRunQueue.addBulk(
      payloads.map((payload) => ({
        name: EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
        data: payload,
        opts: { jobId: payload.runRecordId },
      })),
    )
  }

  async retryRunRecords(payloads: ProcessEvaluationExtractionRunRecordJobPayload[]): Promise<void> {
    for (const payload of payloads) {
      const job = await this.evaluationExtractionRunQueue.getJob(payload.runRecordId)
      if (!job) {
        await this.evaluationExtractionRunQueue.add(
          EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
          payload,
          { jobId: payload.runRecordId },
        )
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
      const job = await this.evaluationExtractionRunQueue.getJob(runRecordId)
      if (!job) continue

      const state = await job.getState()
      if (state === "active") {
        this.logger.log(
          `Job Evaluation Run Record with id "${runRecordId}" is active — relying on cooperative cancel in processor`,
        )
        continue
      }

      try {
        await job.remove()
      } catch (error) {
        this.logger.warn(
          `Failed to remove job Evaluation Run Record with id "${runRecordId}" (state=${state}): ${error instanceof Error ? error.message : error}`,
        )
      }
    }
  }
}
