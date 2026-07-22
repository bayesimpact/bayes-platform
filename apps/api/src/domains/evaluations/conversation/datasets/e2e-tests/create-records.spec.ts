import { randomUUID } from "node:crypto"
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

describe("EvaluationConversationDatasets - createRecords", () => {
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

  const subject = async (
    payload?: typeof EvaluationConversationDatasetsRoutes.createRecords.request,
  ) =>
    request({
      route: EvaluationConversationDatasetsRoutes.createRecords,
      pathParams: removeNullish({ organizationId, projectId, datasetId }),
      token: accessToken,
      request: payload,
    })

  it("should create many records in one call", async () => {
    await createContext()

    const res = await subject({
      payload: {
        records: [
          { input: "Question 1", expectedOutput: "Answer 1" },
          { input: "Question 2", expectedOutput: "Answer 2" },
          { input: "Question 3", expectedOutput: "Answer 3" },
        ],
      },
    })

    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({ success: true })

    const records = await recordRepository.find()
    expect(records).toHaveLength(3)
    expect(records.map((record) => record.input).sort()).toEqual([
      "Question 1",
      "Question 2",
      "Question 3",
    ])
    for (const record of records) {
      expect(record.evaluationConversationDatasetId).toBe(datasetId)
      expect(record.organizationId).toBe(organizationId)
      expect(record.projectId).toBe(projectId)
    }
  })

  it("should reject an empty array", async () => {
    await createContext()

    const res = await subject({ payload: { records: [] } })

    expectResponse(res, 422)

    const records = await recordRepository.find()
    expect(records).toHaveLength(0)
  })

  it("should reject and persist nothing when any input is blank", async () => {
    await createContext()

    const res = await subject({
      payload: {
        records: [
          { input: "Question 1", expectedOutput: "Answer 1" },
          { input: "   ", expectedOutput: "Answer 2" },
        ],
      },
    })

    expectResponse(res, 422)

    const records = await recordRepository.find()
    expect(records).toHaveLength(0)
  })

  it("should reject and persist nothing when any expected output is blank", async () => {
    await createContext()

    const res = await subject({
      payload: {
        records: [
          { input: "Question 1", expectedOutput: "Answer 1" },
          { input: "Question 2", expectedOutput: "   " },
        ],
      },
    })

    expectResponse(res, 422)

    const records = await recordRepository.find()
    expect(records).toHaveLength(0)
  })

  it("should return 404 for a non-existent dataset", async () => {
    await createContext()
    datasetId = randomUUID()

    const res = await subject({
      payload: { records: [{ input: "Question 1", expectedOutput: "Answer 1" }] },
    })

    expectResponse(res, 404)
  })
})
