import { AgentModel } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import type { Agent } from "@/domains/agents/agent.entity"
import { agentFactory } from "@/domains/agents/agent.factory"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { LlmModule } from "@/external/llm/llm.module"
import {
  EvaluationExtractionDataset,
  type EvaluationExtractionDatasetSchemaMapping,
} from "../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "./evaluation-extraction-run.factory"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunProcessorService } from "./evaluation-extraction-run-processor.service"
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

const QUESTION_COLUMN_ID = "col-question"
const ANSWER_COLUMN_ID = "col-answer"

// The mock structured-output provider returns `{ content, source: "MOCK" }`, so mapping the
// `source` key against a ground truth of "MOCK" grades to a match (and anything else mismatches).
const MATCHING_GROUND_TRUTH = "MOCK"
const MISMATCHING_GROUND_TRUTH = "NOT-A-MOCK"

const schemaMapping: EvaluationExtractionDatasetSchemaMapping = {
  [QUESTION_COLUMN_ID]: {
    id: QUESTION_COLUMN_ID,
    index: 0,
    originalName: "question",
    finalName: "question",
    role: "input",
  },
  [ANSWER_COLUMN_ID]: {
    id: ANSWER_COLUMN_ID,
    index: 1,
    originalName: "answer",
    finalName: "answer",
    role: "target",
  },
}

const mockFileStorageService = {
  save: jest.fn(),
  readFile: jest.fn(),
  getTemporaryUrl: jest.fn(),
  createReadStream: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("EvaluationExtractionRunProcessorService", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let service: EvaluationExtractionRunProcessorService
  let datasetRepository: Repository<EvaluationExtractionDataset>
  let datasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>
  let runRepository: Repository<EvaluationExtractionRun>
  let runRecordRepository: Repository<EvaluationExtractionRunRecord>

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [LlmModule, DocumentsModule, StorageModule],
      providers: [
        EvaluationExtractionRunProcessorService,
        EvaluationExtractionRunStatusNotifierService,
        EvaluationExtractionRunGraderService,
        EvaluationExtractionRunCsvExportService,
      ],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder.overrideProvider(FILE_STORAGE_SERVICE).useValue(mockFileStorageService),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    datasetRecordRepository = setup.getRepository(EvaluationExtractionDatasetRecord)
    runRepository = setup.getRepository(EvaluationExtractionRun)
    runRecordRepository = setup.getRepository(EvaluationExtractionRunRecord)
    app = setup.module.createNestApplication()
    await app.init()
    service = app.get(EvaluationExtractionRunProcessorService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    mockFileStorageService.save.mockResolvedValue({
      fileId: "00000000-0000-0000-0000-00000000fa11",
      storageRelativePath: "some/path.csv",
    })
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a running run with one record per `groundTruths` entry. Each record is wired to a
   * dataset record whose target column holds the given ground truth, so the caller controls
   * whether processing that record grades to a match or a mismatch.
   */
  const seedRun = async (
    groundTruths: string[],
  ): Promise<{
    payloadFor: (index: number) => ProcessEvaluationExtractionRunRecordJobPayload
    runId: string
  }> => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope: RequiredConnectScope = {
      organizationId: organization.id,
      projectId: project.id,
    }

    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ name: "My Dataset", schemaMapping })
    await datasetRepository.save(dataset)

    const agent: Agent = agentFactory.transient({ organization, project }).build({
      type: "extraction",
      outputJsonSchema: { type: "object" },
      model: AgentModel._MockGenerateStructuredOutput,
    })
    await repositories.agentRepository.save(agent)

    const run = evaluationExtractionRunFactory
      .transient({ organization, project, agent, evaluationExtractionDataset: dataset })
      .build({
        status: "running",
        keyMapping: [
          { agentOutputKey: "source", datasetColumnId: ANSWER_COLUMN_ID, mode: "scored" },
        ],
        summary: {
          total: groundTruths.length,
          perfectMatches: 0,
          mismatches: 0,
          errors: 0,
          running: groundTruths.length,
        },
      })
    await runRepository.save(run)

    const payloads = await Promise.all(
      groundTruths.map(async (groundTruth) => {
        const datasetRecord = datasetRecordRepository.create({
          organizationId: organization.id,
          projectId: project.id,
          evaluationExtractionDatasetId: dataset.id,
          data: { [QUESTION_COLUMN_ID]: "1+1", [ANSWER_COLUMN_ID]: groundTruth },
        })
        await datasetRecordRepository.save(datasetRecord)

        const runRecord = runRecordRepository.create({
          organizationId: organization.id,
          projectId: project.id,
          evaluationExtractionRunId: run.id,
          evaluationExtractionDatasetRecordId: datasetRecord.id,
          status: "running",
        })
        await runRecordRepository.save(runRecord)

        return {
          evaluationExtractionRun: run,
          runRecordId: runRecord.id,
          connectScope,
          schemaMapping,
          agent,
        } satisfies ProcessEvaluationExtractionRunRecordJobPayload
      }),
    )

    const payloadFor = (index: number): ProcessEvaluationExtractionRunRecordJobPayload => {
      const payload = payloads[index]
      if (!payload) {
        throw new Error(`No payload seeded at index ${index}`)
      }
      return payload
    }

    return { payloadFor, runId: run.id }
  }

  const reloadRun = async (runId: string): Promise<EvaluationExtractionRun> => {
    const run = await runRepository.findOneByOrFail({ id: runId })
    return run
  }

  it("completes the run and generates the CSV exactly once when records finish concurrently", async () => {
    const { payloadFor, runId } = await seedRun([
      MATCHING_GROUND_TRUTH,
      MATCHING_GROUND_TRUTH,
      MATCHING_GROUND_TRUTH,
    ])

    await Promise.all([
      service.processRunRecord(payloadFor(0)),
      service.processRunRecord(payloadFor(1)),
      service.processRunRecord(payloadFor(2)),
    ])

    const run = await reloadRun(runId)
    expect(run.status).toBe("completed")
    expect(run.summary).toMatchObject({
      total: 3,
      perfectMatches: 3,
      mismatches: 0,
      errors: 0,
      running: 0,
    })
    expect(mockFileStorageService.save).toHaveBeenCalledTimes(1)
  })

  it("keeps the run running until the final record completes", async () => {
    const { payloadFor, runId } = await seedRun([MATCHING_GROUND_TRUTH, MISMATCHING_GROUND_TRUTH])

    await service.processRunRecord(payloadFor(0))

    let run = await reloadRun(runId)
    expect(run.status).toBe("running")
    expect(run.summary).toMatchObject({ perfectMatches: 1, mismatches: 0, running: 1 })
    expect(mockFileStorageService.save).not.toHaveBeenCalled()

    await service.processRunRecord(payloadFor(1))

    run = await reloadRun(runId)
    expect(run.status).toBe("completed")
    expect(run.summary).toMatchObject({ perfectMatches: 1, mismatches: 1, running: 0 })
    expect(mockFileStorageService.save).toHaveBeenCalledTimes(1)
  })

  it("fails the run immediately on the first errored record and never generates a CSV", async () => {
    const { payloadFor, runId } = await seedRun([
      MATCHING_GROUND_TRUTH,
      MATCHING_GROUND_TRUTH,
      MATCHING_GROUND_TRUTH,
    ])

    await service.processRunRecord(payloadFor(0))
    await service.markRecordFailed(payloadFor(1), new Error("boom"))

    const run = await reloadRun(runId)
    // Failed mid-run: the third record is still running, yet the run is already failed.
    expect(run.status).toBe("failed")
    expect(run.summary).toMatchObject({ perfectMatches: 1, errors: 1, running: 1 })
    expect(mockFileStorageService.save).not.toHaveBeenCalled()
  })

  it("does not double-count when an already-processed record is reprocessed", async () => {
    const { payloadFor, runId } = await seedRun([MATCHING_GROUND_TRUTH, MATCHING_GROUND_TRUTH])

    await service.processRunRecord(payloadFor(0))
    // Simulate a redelivery of the same job after it already succeeded.
    await service.processRunRecord(payloadFor(0))

    let run = await reloadRun(runId)
    expect(run.summary).toMatchObject({ perfectMatches: 1, running: 1 })

    await service.processRunRecord(payloadFor(1))

    run = await reloadRun(runId)
    expect(run.status).toBe("completed")
    expect(run.summary).toMatchObject({ perfectMatches: 2, running: 0 })
    expect(mockFileStorageService.save).toHaveBeenCalledTimes(1)
  })
})
