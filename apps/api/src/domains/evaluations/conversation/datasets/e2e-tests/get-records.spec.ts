import { EvaluationConversationDatasetsRoutes } from "@caseai-connect/api-contracts"
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
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../records/evaluation-conversation-dataset-record.factory"

describe("EvaluationConversationDatasets - getRecords", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationConversationDataset>
  let recordRepository: Repository<EvaluationConversationDatasetRecord>

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
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationConversationDataset)
    recordRepository = setup.getRepository(EvaluationConversationDatasetRecord)
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(dataset)
    datasetId = dataset.id

    return { organization, project, dataset }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationDatasetsRoutes.getRecords,
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
      const record = evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build({ input: `question_${index}`, expectedOutput: `answer_${index}` })
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
      const record = evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build({ input: `question_${index}`, expectedOutput: `answer_${index}` })
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

    const record = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "My question", expectedOutput: "My expected answer" })
    await recordRepository.save(record)

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]).toMatchObject({
      id: expect.any(String),
      input: "My question",
      expectedOutput: "My expected answer",
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })

  it("should return records sorted by creation date ascending", async () => {
    const { organization, project, dataset } = await createContext()

    const olderRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "Older question", createdAt: new Date("2024-01-01") })
    const newerRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "Newer question", createdAt: new Date("2024-06-01") })
    await recordRepository.save([newerRecord, olderRecord])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(2)
    expect(res.body.data.records[0]!.input).toBe("Older question")
    expect(res.body.data.records[1]!.input).toBe("Newer question")
  })

  it("should not return records from another dataset", async () => {
    const { organization, project, dataset } = await createContext()

    const otherDataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build()
    await datasetRepository.save(otherDataset)

    const record = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "In dataset" })
    const otherRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: otherDataset })
      .build({ input: "In other dataset" })
    await recordRepository.save([record, otherRecord])

    const res = await subject()

    expectResponse(res)
    expect(res.body.data.records).toHaveLength(1)
    expect(res.body.data.records[0]!.input).toBe("In dataset")
    expect(res.body.data.total).toBe(1)
  })
})
