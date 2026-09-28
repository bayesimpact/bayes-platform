import { EvaluationExtractionDatasetsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetDocument } from "../../datasets/evaluation-extraction-dataset-document.entity"
import { evaluationExtractionDatasetDocumentFactory } from "../../datasets/evaluation-extraction-dataset-document.factory"
import { EvaluationExtractionDatasetRecord } from "../../datasets/records/evaluation-extraction-dataset-record.entity"
import { evaluationExtractionDatasetRecordFactory } from "../../datasets/records/evaluation-extraction-dataset-record.factory"

describe("EvaluationExtractionDatasets - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationExtractionDataset>
  let datasetDocumentRepository: Repository<EvaluationExtractionDatasetDocument>
  let recordRepository: Repository<EvaluationExtractionDatasetRecord>

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    datasetDocumentRepository = setup.getRepository(EvaluationExtractionDatasetDocument)
    recordRepository = setup.getRepository(EvaluationExtractionDatasetRecord)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const document = evaluationExtractionDatasetDocumentFactory
      .transient({ organization, project })
      .build()
    await datasetDocumentRepository.save(document)

    return { organization, project, document }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return an empty list when no datasets exist", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toEqual([])
  })

  it("should return a list of datasets", async () => {
    const { organization, project, document } = await createContext()

    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ name: "My Dataset", evaluationExtractionDatasetDocumentId: document.id })
    await datasetRepository.save(dataset)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: dataset.id,
      name: "My Dataset",
      projectId,
      documentId: document.id,
    })
  })

  it("should return datasets with recordCount", async () => {
    const { organization, project } = await createContext()

    const schemaMapping = {
      col1: {
        id: "col1",
        finalName: "Column 1",
        originalName: "col1",
        index: 0,
        role: "input" as const,
      },
    }
    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ schemaMapping })
    await datasetRepository.save(dataset)

    const record = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "value1" } })
    await recordRepository.save(record)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]!.recordCount).toBe(1)
  })

  it("should return datasets sorted by newest first", async () => {
    const { organization, project } = await createContext()

    const dataset1 = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ name: "Older Dataset", updatedAt: new Date("2024-01-01") })
    const dataset2 = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ name: "Newer Dataset", updatedAt: new Date("2024-06-01") })
    await datasetRepository.save([dataset1, dataset2])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0]!.name).toBe("Newer Dataset")
    expect(res.body.data[1]!.name).toBe("Older Dataset")
  })

  it("should return datasets with all required fields", async () => {
    const { organization, project } = await createContext()

    const dataset = evaluationExtractionDatasetFactory.transient({ organization, project }).build()
    await datasetRepository.save(dataset)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      projectId,
      schemaMapping: expect.any(Object),
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      documentId: null,
      recordCount: expect.any(Number),
    })
  })
})
