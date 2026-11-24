import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { StructuredExtractionAgentRunLlmService } from "@/domains/agents/shared/structured-extraction-agent-run-llm.service"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { LlmModule } from "@/external/llm/llm.module"
import { evaluationExtractionDatasetFactory } from "../datasets/evaluation-extraction-dataset.factory"
import type { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import { EVALUATION_EXTRACTION_RUN_QUEUE_NAME } from "./evaluation-extraction-run.constants"
import { evaluationExtractionRunFactory } from "./evaluation-extraction-run.factory"
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunProcessorService } from "./evaluation-extraction-run-processor.service"
import { EvaluationExtractionRunStarterService } from "./evaluation-extraction-run-starter.service"
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"

const mockQueue = { addBulk: jest.fn() }
const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }
const mockCsvExport = { generateAndStoreDocument: jest.fn() }

describe("EvaluationExtractionRunStarterService", () => {
  let service: EvaluationExtractionRunStarterService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule],
      providers: [
        EvaluationExtractionRunStarterService,
        // The real processor: it owns the end of a run, which a run on no record reaches at its
        // start.
        EvaluationExtractionRunProcessorService,
        StructuredExtractionAgentRunLlmService,
        EvaluationExtractionRunGraderService,
        { provide: EvaluationExtractionRunStatusNotifierService, useValue: mockStatusNotifier },
        { provide: EvaluationExtractionRunCsvExportService, useValue: mockCsvExport },
        { provide: getQueueToken(EVALUATION_EXTRACTION_RUN_QUEUE_NAME), useValue: mockQueue },
        ProjectRepository,
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(EvaluationExtractionRunStarterService)
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
        agent: { name: "Extractor", type: "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
        },
      },
    )

    const dataset = evaluationExtractionDatasetFactory.transient({ organization, project }).build({
      name: "My Dataset",
      schemaMapping: {
        "col-name": {
          id: "col-name",
          index: 0,
          originalName: "name",
          finalName: "name",
          role: "input",
        },
      },
    })
    await repositories.evaluationExtractionDatasetRepository.save(dataset)

    const datasetRecords: EvaluationExtractionDatasetRecord[] = []
    for (let index = 0; index < datasetRecordCount; index += 1) {
      const datasetRecord = repositories.evaluationExtractionDatasetRecordRepository.create({
        organizationId: organization.id,
        projectId: project.id,
        evaluationExtractionDatasetId: dataset.id,
        data: { "col-name": `Row ${index}` },
      })
      await repositories.evaluationExtractionDatasetRecordRepository.save(datasetRecord)
      datasetRecords.push(datasetRecord)
    }

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build({ status: "pending", summary: null })
    await repositories.evaluationExtractionRunRepository.save(run)

    return { organizationId: organization.id, projectId: project.id, run, datasetRecords }
  }

  it("startRun - should works", async () => {
    const { organizationId, projectId, run, datasetRecords } = await seedRunAndDatasetRecords(2)

    await service.startRun({
      evaluationExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    const records = await repositories.evaluationExtractionRunRecordRepository.find({
      where: { evaluationExtractionRunId: run.id },
    })
    expect(records).toHaveLength(2)
    expect(records.every((record) => record.status === "running")).toBe(true)
    expect(records.map((record) => record.evaluationExtractionDatasetRecordId).sort()).toEqual(
      datasetRecords.map((datasetRecord) => datasetRecord.id).sort(),
    )

    // One bulk enqueue with one job per record, keyed by the record id.
    expect(mockQueue.addBulk).toHaveBeenCalledTimes(1)
    const enqueuedJobs = mockQueue.addBulk.mock.calls[0]![0]
    expect(enqueuedJobs).toHaveLength(2)
    expect(enqueuedJobs.map((job: { opts: { jobId: string } }) => job.opts.jobId).sort()).toEqual(
      records.map((record) => record.id).sort(),
    )

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("running")
    expect(updatedRun.summary).toEqual({
      total: 2,
      perfectMatches: 0,
      mismatches: 0,
      errors: 0,
      running: 2,
    })
  })

  it("startRun - should only process recordLimit", async () => {
    const { organizationId, projectId, run } = await seedRunAndDatasetRecords(3)

    await service.startRun({
      evaluationExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: 1,
    })

    const records = await repositories.evaluationExtractionRunRecordRepository.find({
      where: { evaluationExtractionRunId: run.id },
    })
    expect(records).toHaveLength(1)

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.summary).toEqual({
      total: 1,
      perfectMatches: 0,
      mismatches: 0,
      errors: 0,
      running: 1,
    })
  })

  it("startRun - completes at once the run of a dataset with no record", async () => {
    const { organizationId, projectId, run } = await seedRunAndDatasetRecords(0)

    await service.startRun({
      evaluationExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    // No record job will ever end this run: it must not stay "running".
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({
      total: 0,
      perfectMatches: 0,
      mismatches: 0,
      errors: 0,
      running: 0,
    })
    expect(mockQueue.addBulk).not.toHaveBeenCalled()
    // Like any completed run, it gets its export and tells its status to the people who watch it.
    expect(mockCsvExport.generateAndStoreDocument).toHaveBeenCalledTimes(1)
    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ evaluationExtractionRunId: run.id, status: "completed" }),
    )
  })

  it("startRun - should throws when run not found", async () => {
    const { organizationId, projectId } = await seedRunAndDatasetRecords(1)

    await expect(
      service.startRun({
        evaluationExtractionRunId: "00000000-0000-0000-0000-000000000000",
        organizationId,
        projectId,
        recordLimit: null,
      }),
    ).rejects.toThrow(/not found/)

    expect(mockQueue.addBulk).not.toHaveBeenCalled()
  })
})
