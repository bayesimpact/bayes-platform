import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_JOB_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
} from "./evaluation-extraction-run.constants"
import type {
  ExecuteEvaluationExtractionRunJobPayload,
  ProcessEvaluationExtractionRunRecordJobPayload,
} from "./evaluation-extraction-run.types"

@Injectable()
export class BullMqEvaluationExtractionRunBatchService {
  private readonly logger = new Logger(BullMqEvaluationExtractionRunBatchService.name)

  constructor(
    @InjectQueue(EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME)
    private readonly executeQueue: Queue<ExecuteEvaluationExtractionRunJobPayload>,
    @InjectQueue(EVALUATION_EXTRACTION_RUN_QUEUE_NAME)
    private readonly recordQueue: Queue<ProcessEvaluationExtractionRunRecordJobPayload>,
  ) {}

  async enqueueExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    this.logger.log(
      `Enqueuing execute run job (evaluationExtractionRunId=${payload.evaluationExtractionRunId})`,
    )
    await this.executeQueue.add(EVALUATION_EXTRACTION_RUN_JOB_NAME, payload, {
      jobId: `execute-run-${payload.evaluationExtractionRunId}`,
    })
  }

  async enqueueRunRecords(
    payloads: ProcessEvaluationExtractionRunRecordJobPayload[],
  ): Promise<void> {
    if (payloads.length === 0) return
    this.logger.log(
      `Enqueuing ${payloads.length} evaluation run record jobs (evaluationExtractionRunId=${payloads[0]?.evaluationExtractionRun.id})`,
    )
    await this.recordQueue.addBulk(
      payloads.map((payload) => ({
        name: EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME,
        data: payload,
        opts: { jobId: payload.runRecordId },
      })),
    )
  }

  async retryRunRecords(payloads: ProcessEvaluationExtractionRunRecordJobPayload[]): Promise<void> {
    for (const payload of payloads) {
      const job = await this.recordQueue.getJob(payload.runRecordId)
      if (!job) {
        await this.recordQueue.add(EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME, payload, {
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
