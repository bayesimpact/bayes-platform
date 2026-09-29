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
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../../datasets/records/evaluation-extraction-dataset-record.entity"
import { evaluationExtractionDatasetRecordFactory } from "../../datasets/records/evaluation-extraction-dataset-record.factory"

describe("EvaluationExtractionDatasets - getRecords", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationExtractionDataset>
  let recordRepository: Repository<EvaluationExtractionDatasetRecord>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  let queryParams: Record<string, string> = {}

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    recordRepository = setup.getRepository(EvaluationExtractionDatasetRecord)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    queryParams = {}
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithDocument(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const schemaMapping = {
      col1: {
        id: "col1",
        finalName: "Title",
        originalName: "title",
        index: 0,
        role: "input" as const,
      },
      col2: {
        id: "col2",
        finalName: "Abstract",
        originalName: "abstract",
        index: 1,
        role: "target" as const,
      },
    }
    const dataset = evaluationExtractionDatasetFactory
      .transient({ organization, project })
      .build({ schemaMapping })
    await datasetRepository.save(dataset)
    datasetId = dataset.id

    return { organization, project, dataset }
  }

  const subject = async () =>
    request({
      route: EvaluationExtractionDatasetsRoutes.getRecords,
      pathParams: removeNullish({ organizationId, projectId, datasetId }),
      query: queryParams,
      token: accessToken,
    })

  it("should return an empty list when no records exist", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toEqual([])
    expect(res.body.data.total).toBe(0)
    expect(res.body.data.page).toBe(0)
    expect(res.body.data.limit).toBe(10)
  })

  it("should return paginated records", async () => {
    const { organization, project, dataset } = await createContext()

    for (let index = 0; index < 5; index++) {
      const record = evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: dataset })
        .build({ data: { col1: `title_${index}`, col2: `abstract_${index}` } })
      await recordRepository.save(record)
    }

    queryParams = { page: "0", limit: "2" }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(2)
    expect(res.body.data.total).toBe(5)
    expect(res.body.data.page).toBe(0)
    expect(res.body.data.limit).toBe(2)
  })

  it("should return second page of records", async () => {
    const { organization, project, dataset } = await createContext()

    for (let index = 0; index < 5; index++) {
      const record = evaluationExtractionDatasetRecordFactory
        .transient({ organization, project, evaluationExtractionDataset: dataset })
        .build({ data: { col1: `title_${index}`, col2: `abstract_${index}` } })
      await recordRepository.save(record)
    }

    queryParams = { page: "1", limit: "2" }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(2)
    expect(res.body.data.total).toBe(5)
    expect(res.body.data.page).toBe(1)
  })

  it("should return records with correct data shape", async () => {
    const { organization, project, dataset } = await createContext()

    const record = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "My Title", col2: "My Abstract" } })
    await recordRepository.save(record)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]).toMatchObject({
      id: expect.any(String),
      data: { col1: "My Title", col2: "My Abstract" },
    })
  })

  it("should filter records by column", async () => {
    const { organization, project, dataset } = await createContext()

    const record1 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Systematic review of lung cancer", col2: "abstract1" } })
    const record2 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Heart disease study", col2: "abstract2" } })
    await recordRepository.save([record1, record2])

    queryParams = { columnFilters: JSON.stringify({ col1: "lung cancer" }) }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]!.data.col1).toBe("Systematic review of lung cancer")
    expect(res.body.data.total).toBe(1)
  })

  it("should filter records by multiple columns", async () => {
    const { organization, project, dataset } = await createContext()

    const record1 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Lung cancer study", col2: "This is about treatment" } })
    const record2 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Lung cancer review", col2: "This is about diagnosis" } })
    const record3 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Heart disease study", col2: "This is about treatment" } })
    await recordRepository.save([record1, record2, record3])

    queryParams = { columnFilters: JSON.stringify({ col1: "lung", col2: "treatment" }) }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]!.data.col1).toBe("Lung cancer study")
    expect(res.body.data.total).toBe(1)
  })

  it("should sort records by column", async () => {
    const { organization, project, dataset } = await createContext()

    const record1 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Zebra study", col2: "abstract1" } })
    const record2 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Apple research", col2: "abstract2" } })
    await recordRepository.save([record1, record2])

    queryParams = { sortBy: "col1", sortOrder: "asc" }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(2)
    expect(res.body.data.records[0]!.data.col1).toBe("Apple research")
    expect(res.body.data.records[1]!.data.col1).toBe("Zebra study")
  })

  it("should sort records descending", async () => {
    const { organization, project, dataset } = await createContext()

    const record1 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Apple research", col2: "abstract1" } })
    const record2 = evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data: { col1: "Zebra study", col2: "abstract2" } })
    await recordRepository.save([record1, record2])

    queryParams = { sortBy: "col1", sortOrder: "desc" }
    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(2)
    expect(res.body.data.records[0]!.data.col1).toBe("Zebra study")
    expect(res.body.data.records[1]!.data.col1).toBe("Apple research")
  })
})
