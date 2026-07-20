import type { Queue } from "bullmq"
import { BullMqEvaluationConversationRunBatchService } from "./bull-mq-evaluation-conversation-run-batch.service"
import {
  EVALUATION_CONVERSATION_RUN_JOB_NAME,
  EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
} from "./evaluation-conversation-run.constants"
import type {
  ExecuteEvaluationConversationRunJobPayload,
  ProcessEvaluationConversationRunRecordJobPayload,
} from "./evaluation-conversation-run.types"

const recordPayload = (runRecordId: string): ProcessEvaluationConversationRunRecordJobPayload =>
  ({
    runRecordId,
    evaluationConversationRun: { id: "run-1" },
  }) as ProcessEvaluationConversationRunRecordJobPayload

describe("BullMqEvaluationConversationRunBatchService", () => {
  let service: BullMqEvaluationConversationRunBatchService
  let executeQueue: { add: jest.Mock }
  let recordQueue: { add: jest.Mock; addBulk: jest.Mock; getJob: jest.Mock }

  beforeEach(() => {
    executeQueue = { add: jest.fn() }
    recordQueue = { add: jest.fn(), addBulk: jest.fn(), getJob: jest.fn() }
    service = new BullMqEvaluationConversationRunBatchService(
      executeQueue as unknown as Queue<ExecuteEvaluationConversationRunJobPayload>,
      recordQueue as unknown as Queue<ProcessEvaluationConversationRunRecordJobPayload>,
    )
  })

  it("enqueueExecuteRun - should works", async () => {
    const payload: ExecuteEvaluationConversationRunJobPayload = {
      evaluationConversationRunId: "run-1",
      organizationId: "org-1",
      projectId: "project-1",
      recordLimit: null,
    }

    await service.enqueueExecuteRun(payload)

    expect(executeQueue.add).toHaveBeenCalledWith(EVALUATION_CONVERSATION_RUN_JOB_NAME, payload, {
      jobId: "execute-run-run-1",
    })
  })

  it("enqueueRunRecords - should works", async () => {
    const payloads = [recordPayload("record-1"), recordPayload("record-2")]

    await service.enqueueRunRecords(payloads)

    expect(recordQueue.addBulk).toHaveBeenCalledTimes(1)
    expect(recordQueue.addBulk).toHaveBeenCalledWith([
      {
        name: EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
        data: payloads[0],
        opts: { jobId: "record-1" },
      },
      {
        name: EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
        data: payloads[1],
        opts: { jobId: "record-2" },
      },
    ])
  })

  it("enqueueRunRecords - should do nothing when empty", async () => {
    await service.enqueueRunRecords([])
    expect(recordQueue.addBulk).not.toHaveBeenCalled()
  })

  it("retryRunRecords - should works", async () => {
    recordQueue.getJob.mockResolvedValue(undefined)
    const payload = recordPayload("record-1")

    await service.retryRunRecords([payload])

    expect(recordQueue.add).toHaveBeenCalledWith(
      EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
      payload,
      { jobId: "record-1" },
    )
  })

  it("retryRunRecords - should retry failed job in place", async () => {
    const failedJob = {
      getState: jest.fn().mockResolvedValue("failed"),
      retry: jest.fn(),
      remove: jest.fn(),
    }
    recordQueue.getJob.mockResolvedValue(failedJob)

    await service.retryRunRecords([recordPayload("failed-record")])

    expect(failedJob.retry).toHaveBeenCalledTimes(1)
    expect(failedJob.remove).not.toHaveBeenCalled()
    expect(recordQueue.add).not.toHaveBeenCalled()
  })

  it("retryRunRecords - should replace completed job with a fresh one", async () => {
    const completedJob = {
      getState: jest.fn().mockResolvedValue("completed"),
      retry: jest.fn(),
      remove: jest.fn(),
    }
    recordQueue.getJob.mockResolvedValue(completedJob)
    const payload = recordPayload("done-record")

    await service.retryRunRecords([payload])

    expect(completedJob.retry).not.toHaveBeenCalled()
    expect(completedJob.remove).toHaveBeenCalledTimes(1)
    expect(recordQueue.add).toHaveBeenCalledWith(
      EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME,
      payload,
      { jobId: "done-record" },
    )
  })

  it("retryRunRecords - should leave pending job untouched", async () => {
    const waitingJob = {
      getState: jest.fn().mockResolvedValue("waiting"),
      retry: jest.fn(),
      remove: jest.fn(),
    }
    recordQueue.getJob.mockResolvedValue(waitingJob)

    await service.retryRunRecords([recordPayload("waiting-record")])

    expect(waitingJob.retry).not.toHaveBeenCalled()
    expect(waitingJob.remove).not.toHaveBeenCalled()
    expect(recordQueue.add).not.toHaveBeenCalled()
  })

  describe("removePendingRunRecords", () => {
    it("removePendingRunRecords - should works", async () => {
      const job = {
        getState: jest.fn().mockResolvedValue("waiting"),
        remove: jest.fn(),
      }
      recordQueue.getJob.mockResolvedValue(job)

      await service.removePendingRunRecords(["record-1"])

      expect(job.remove).toHaveBeenCalledTimes(1)
    })

    it("removePendingRunRecords - should not remove active", async () => {
      const job = { getState: jest.fn().mockResolvedValue("active"), remove: jest.fn() }
      recordQueue.getJob.mockResolvedValue(job)

      await service.removePendingRunRecords(["record-1"])

      expect(job.remove).not.toHaveBeenCalled()
    })

    it("removePendingRunRecords - should ignore invalid", async () => {
      recordQueue.getJob.mockResolvedValue(undefined)

      await expect(service.removePendingRunRecords(["invalid"])).resolves.toBeUndefined()
    })

    it("removePendingRunRecords - should not throw on failure", async () => {
      const job = {
        getState: jest.fn().mockResolvedValue("waiting"),
        remove: jest.fn().mockRejectedValue(new Error("expected error")),
      }
      recordQueue.getJob.mockResolvedValue(job)

      await expect(service.removePendingRunRecords(["record-1"])).resolves.toBeUndefined()
    })
  })
})
