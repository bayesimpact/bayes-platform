import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  EVALUATION_EXTRACTION_RUN_JOB_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./evaluation-extraction-run.constants"
import type { ExecuteEvaluationExtractionRunJobPayload } from "./evaluation-extraction-run.types"

@Injectable()
export class BullMqEvaluationExtractionRunBatchService {
  private readonly logger = new Logger(BullMqEvaluationExtractionRunBatchService.name)

  constructor(
    @InjectQueue(EVALUATION_EXTRACTION_RUN_QUEUE_NAME)
    private readonly evaluationExtractionRunQueue: Queue<ExecuteEvaluationExtractionRunJobPayload>,
  ) {}

  async enqueueExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    this.logger.log(`Enqueuing evaluation extraction run job ${JSON.stringify(payload)}`)
    await this.evaluationExtractionRunQueue.add(EVALUATION_EXTRACTION_RUN_JOB_NAME, payload, {
      jobId: payload.runId,
    })
  }

  async retryExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void> {
    const job = await this.evaluationExtractionRunQueue.getJob(payload.runId)
    if (!job) return this.logger.log(`Job ${payload.runId} not found when attempting to retry`)
    await job.retry()
  }

  async removePendingJob(runId: string): Promise<void> {
    const job = await this.evaluationExtractionRunQueue.getJob(runId)
    if (!job) return this.logger.log(`Job ${runId} not found when attempting to remove`)

    const state = await job.getState()
    if (state === "active") {
      this.logger.log(`Job ${runId} is active — relying on cooperative cancel in processor`)
      return
    }

    try {
      await job.remove()
      this.logger.log(`Removed queued evaluation extraction run job ${runId}`)
    } catch (error) {
      this.logger.warn(
        `Failed to remove job ${runId} (state=${state}): ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}
