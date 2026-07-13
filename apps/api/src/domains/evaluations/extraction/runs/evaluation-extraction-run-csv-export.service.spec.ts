import { AgentModel } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { Document } from "@/domains/documents/document.entity"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { EvaluationsModule } from "../../evaluations.module"
import { EvaluationExtractionDataset } from "../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "./evaluation-extraction-run.factory"
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

const mockFileStorageService = {
  save: jest.fn(),
  readFile: jest.fn(),
  getTemporaryUrl: jest.fn(),
  createReadStream: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("EvaluationExtractionRunCsvExportService", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let service: EvaluationExtractionRunCsvExportService
  let datasetRepository: Repository<EvaluationExtractionDataset>
  let datasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>
  let runRepository: Repository<EvaluationExtractionRun>
  let runRecordRepository: Repository<EvaluationExtractionRunRecord>
  let documentRepository: Repository<Document>

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder.overrideProvider(FILE_STORAGE_SERVICE).useValue(mockFileStorageService),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    datasetRecordRepository = setup.getRepository(EvaluationExtractionDatasetRecord)
    runRepository = setup.getRepository(EvaluationExtractionRun)
    runRecordRepository = setup.getRepository(EvaluationExtractionRunRecord)
    documentRepository = setup.getRepository(Document)
    app = setup.module.createNestApplication()
    await app.init()
    service = app.get(EvaluationExtractionRunCsvExportService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const seedRun = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object" },
          model: AgentModel._Mock,
        },
      },
    )

    const targetColumnId = "col-answer"
    const dataset = evaluationExtractionDatasetFactory.transient({ organization, project }).build({
      name: "My Dataset",
      schemaMapping: {
        "col-question": {
          id: "col-question",
          index: 0,
          originalName: "question",
          finalName: "question",
          role: "input",
        },
        [targetColumnId]: {
          id: targetColumnId,
          index: 1,
          originalName: "answer",
          finalName: "answer",
          role: "target",
        },
      },
    })
    await datasetRepository.save(dataset)

    const datasetRecord = datasetRecordRepository.create({
      organizationId: organization.id,
      projectId: project.id,
      evaluationExtractionDatasetId: dataset.id,
      data: { "col-question": "1+1", [targetColumnId]: "2" },
    })
    await datasetRecordRepository.save(datasetRecord)

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build({
        status: "completed",
        keyMapping: [{ agentOutputKey: "answer", datasetColumnId: targetColumnId, mode: "scored" }],
      })
    await runRepository.save(run)

    const runRecord = runRecordRepository.create({
      organizationId: organization.id,
      projectId: project.id,
      evaluationExtractionRunId: run.id,
      evaluationExtractionDatasetRecordId: datasetRecord.id,
      status: "match",
      comparison: {
        answer: { agentValue: "2", groundTruth: "2", status: "match" },
      },
      agentRawOutput: null,
      errorDetails: null,
      traceId: null,
    })
    await runRecordRepository.save(runRecord)

    return { run, organization, project }
  }

  it("uploads the CSV buffer, creates a Document with the right source type, and links it via the join table", async () => {
    const { run } = await seedRun()
    mockFileStorageService.save.mockResolvedValue({
      fileId: "00000000-0000-0000-0000-00000000fa11",
      storageRelativePath: "some/path.csv",
    })

    await service.generateAndStoreDocument(run)

    expect(mockFileStorageService.save).toHaveBeenCalledTimes(1)
    const saveArgs = mockFileStorageService.save.mock.calls[0][0]
    expect(saveArgs.extension).toBe("csv")
    expect(saveArgs.file.mimetype).toBe("text/csv")
    expect(Buffer.isBuffer(saveArgs.file.buffer)).toBe(true)
    const csvText = (saveArgs.file.buffer as Buffer).toString("utf-8")
    expect(csvText.charCodeAt(0)).toBe(0xfeff)
    expect(csvText).toContain("question (input),answer (target),answer (agent),Status")
    expect(csvText).toContain("1+1,2,2,match")

    const document = await documentRepository.findOneBy({
      id: "00000000-0000-0000-0000-00000000fa11",
    })
    expect(document).not.toBeNull()
    expect(document?.sourceType).toBe("evaluationExtractionRun")
    expect(document?.fileName).toMatch(/^My_Dataset_.+_Results\.csv$/)
    expect(document?.mimeType).toBe("text/csv")
    expect(document?.storageRelativePath).toBe("some/path.csv")
    expect(document?.uploadStatus).toBe("uploaded")
    expect(run.csvExportDocumentId).toBe("00000000-0000-0000-0000-00000000fa11")
  })
})
