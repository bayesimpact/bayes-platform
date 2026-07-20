import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_JOB_NAME,
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
} from "./evaluation-conversation-run.constants"
import type {
  ExecuteEvaluationConversationRunJobPayload,
  ProcessEvaluationConversationRunRecordJobPayload,
} from "./evaluation-conversation-run.types"

@Injectable()
export class BullMqEvaluationConversationRunBatchService {
  private readonly logger = new Logger(BullMqEvaluationConversationRunBatchService.name)

  constructor(
    @InjectQueue(EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME)
    private readonly executeQueue: Queue<ExecuteEvaluationConversationRunJobPayload>,
    @InjectQueue(EVALUATION_CONVERSATION_RUN_QUEUE_NAME)
    private readonly recordQueue: Queue<ProcessEvaluationConversationRunRecordJobPayload>,
  ) {}

  async enqueueExecuteRun(payload: ExecuteEvaluationConversationRunJobPayload): Promise<void> {
    this.logger.log(
      `Enqueuing execute run job (evaluationConversationRunId=${payload.evaluationConversationRunId})`,
    )
    await this.executeQueue.add(EVALUATION_CONVERSATION_RUN_JOB_NAME, payload, {
      jobId: `execute-run-${payload.evaluationConversationRunId}`,
    })
  }

  async enqueueRunRecords(
    payloads: ProcessEvaluationConversationRunRecordJobPayload[],
  ): Promise<void> {
    if (payloads.length === 0) return
    this.logger.log(
      `Enqueuing ${payloads.length} evaluation run record jobs (evaluationConversationRunId=${payloads[0]?.evaluationConversationRun.id})`,
    )
    await this.recordQueue.addBulk(
      payloads.map((payload) => ({
        name: EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
        data: payload,
        opts: { jobId: payload.runRecordId },
      })),
    )
  }

  async retryRunRecords(
    payloads: ProcessEvaluationConversationRunRecordJobPayload[],
  ): Promise<void> {
    await Promise.all(
      payloads.map(async (payload) => {
        const job = await this.recordQueue.getJob(payload.runRecordId)
        if (!job) {
          await this.recordQueue.add(EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME, payload, {
            jobId: payload.runRecordId,
          })
          return
        }
        const state = await job.getState()
        if (state === "failed") {
          await job.retry()
          return
        }
        if (state === "completed") {
          // A record that errored in the processor completes its job normally, so
          // job.retry() would never fire. Remove the stale terminal job and enqueue a
          // fresh one under the same id.
          await job.remove()
          await this.recordQueue.add(EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME, payload, {
            jobId: payload.runRecordId,
          })
        }
        // Other states (waiting, active, delayed, ...) mean the job is still pending
        // and will be processed; leave it alone.
      }),
    )
  }

  async removePendingRunRecords(runRecordIds: string[]): Promise<void> {
    await Promise.all(
      runRecordIds.map(async (runRecordId) => {
        const job = await this.recordQueue.getJob(runRecordId)
        if (!job) return

        const state = await job.getState()
        if (state === "active") {
          this.logger.log(
            `Job Evaluation Run Record with id "${runRecordId}" is active — relying on cooperative cancel in processor`,
          )
          return
        }

        try {
          await job.remove()
        } catch (error) {
          this.logger.warn(
            `Failed to remove job Evaluation Run Record with id "${runRecordId}" (state=${state}): ${error instanceof Error ? error.message : error}`,
          )
        }
      }),
    )
  }
}
