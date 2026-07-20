import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { evaluationConversationDatasetFactory } from "../datasets/evaluation-conversation-dataset.factory"
import type { EvaluationConversationDatasetRecord } from "../datasets/records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../datasets/records/evaluation-conversation-dataset-record.factory"
import { EVALUATION_CONVERSATION_RUN_QUEUE_NAME } from "./evaluation-conversation-run.constants"
import { evaluationConversationRunFactory } from "./evaluation-conversation-run.factory"
import { EvaluationConversationRunStarterService } from "./evaluation-conversation-run-starter.service"
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"

const mockQueue = { addBulk: jest.fn() }
const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }

describe("EvaluationConversationRunStarterService", () => {
  let service: EvaluationConversationRunStarterService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      providers: [
        EvaluationConversationRunStarterService,
        { provide: getQueueToken(EVALUATION_CONVERSATION_RUN_QUEUE_NAME), useValue: mockQueue },
        { provide: EvaluationConversationRunStatusNotifierService, useValue: mockStatusNotifier },
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(EvaluationConversationRunStarterService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  const seedRunAndDatasetRecords = async (datasetRecordCount: number) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { name: "Helpful Assistant", type: "conversation" },
        agentSettings: { instructions: "Answer the question." },
      },
    )

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build({ name: "My Dataset" })
    await repositories.evaluationConversationDatasetRepository.save(dataset)

    const datasetRecords: EvaluationConversationDatasetRecord[] = []
    for (let index = 0; index < datasetRecordCount; index += 1) {
      const datasetRecord = evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build({ input: `Question ${index}`, expectedOutput: `Answer ${index}` })
      await repositories.evaluationConversationDatasetRecordRepository.save(datasetRecord)
      datasetRecords.push(datasetRecord)
    }

    const run = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build({ status: "pending", summary: null })
    await repositories.evaluationConversationRunRepository.save(run)

    return { organizationId: organization.id, projectId: project.id, run, datasetRecords }
  }

  it("startRun - should works", async () => {
    const { organizationId, projectId, run, datasetRecords } = await seedRunAndDatasetRecords(2)

    await service.startRun({
      evaluationConversationRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    const records = await repositories.evaluationConversationRunRecordRepository.find({
      where: { evaluationConversationRunId: run.id },
    })
    expect(records).toHaveLength(2)
    expect(records.every((record) => record.status === "running")).toBe(true)
    expect(records.map((record) => record.evaluationConversationDatasetRecordId).sort()).toEqual(
      datasetRecords.map((datasetRecord) => datasetRecord.id).sort(),
    )
    // Records carry snapshot copies of the dataset record content.
    expect(records.map((record) => record.input).sort()).toEqual(
      datasetRecords.map((datasetRecord) => datasetRecord.input).sort(),
    )
    expect(records.map((record) => record.expectedOutput).sort()).toEqual(
      datasetRecords.map((datasetRecord) => datasetRecord.expectedOutput).sort(),
    )

    // One bulk enqueue with one job per record, keyed by the record id.
    expect(mockQueue.addBulk).toHaveBeenCalledTimes(1)
    const enqueuedJobs = mockQueue.addBulk.mock.calls[0]![0]
    expect(enqueuedJobs).toHaveLength(2)
    expect(enqueuedJobs.map((job: { opts: { jobId: string } }) => job.opts.jobId).sort()).toEqual(
      records.map((record) => record.id).sort(),
    )

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("running")
    expect(updatedRun.summary).toEqual({
      total: 2,
      graded: 0,
      errors: 0,
      running: 2,
      averageScore: null,
    })
  })

  it("startRun - should only process recordLimit", async () => {
    const { organizationId, projectId, run } = await seedRunAndDatasetRecords(3)

    await service.startRun({
      evaluationConversationRunId: run.id,
      organizationId,
      projectId,
      recordLimit: 1,
    })

    const records = await repositories.evaluationConversationRunRecordRepository.find({
      where: { evaluationConversationRunId: run.id },
    })
    expect(records).toHaveLength(1)

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.summary).toEqual({
      total: 1,
      graded: 0,
      errors: 0,
      running: 1,
      averageScore: null,
    })
  })

  it("startRun - should complete immediately when the dataset has no record", async () => {
    const { organizationId, projectId, run } = await seedRunAndDatasetRecords(0)

    await service.startRun({
      evaluationConversationRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    expect(mockQueue.addBulk).not.toHaveBeenCalled()

    const records = await repositories.evaluationConversationRunRecordRepository.find({
      where: { evaluationConversationRunId: run.id },
    })
    expect(records).toHaveLength(0)

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({
      total: 0,
      graded: 0,
      errors: 0,
      running: 0,
      averageScore: null,
    })

    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationConversationRunId: run.id,
        status: "completed",
      }),
    )
  })

  it("startRun - should throws when run not found", async () => {
    const { organizationId, projectId } = await seedRunAndDatasetRecords(1)

    await expect(
      service.startRun({
        evaluationConversationRunId: "00000000-0000-0000-0000-000000000000",
        organizationId,
        projectId,
        recordLimit: null,
      }),
    ).rejects.toThrow(/not found/)

    expect(mockQueue.addBulk).not.toHaveBeenCalled()
  })
})
