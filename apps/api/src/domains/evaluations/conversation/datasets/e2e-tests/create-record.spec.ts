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

describe("EvaluationConversationDatasets - createRecord", () => {
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
    payload?: typeof EvaluationConversationDatasetsRoutes.createRecord.request,
  ) =>
    request({
      route: EvaluationConversationDatasetsRoutes.createRecord,
      pathParams: removeNullish({ organizationId, projectId, datasetId }),
      token: accessToken,
      request: payload,
    })

  it("should create a record with input and expected output", async () => {
    await createContext()

    const res = await subject({
      payload: { input: "Sample question", expectedOutput: "Sample expected answer" },
    })

    expectResponse(res, 201)
    expect(res.body.data).toMatchObject({ success: true })

    const records = await recordRepository.find()
    expect(records).toHaveLength(1)
    expect(records[0]!.input).toBe("Sample question")
    expect(records[0]!.expectedOutput).toBe("Sample expected answer")
    expect(records[0]!.evaluationConversationDatasetId).toBe(datasetId)
  })

  it("should create a record scoped to the project", async () => {
    await createContext()

    await subject({
      payload: { input: "Sample question", expectedOutput: "Sample expected answer" },
    })

    const records = await recordRepository.find()
    expect(records).toHaveLength(1)
    expect(records[0]!.organizationId).toBe(organizationId)
    expect(records[0]!.projectId).toBe(projectId)
  })

  it("should reject an empty input", async () => {
    await createContext()

    const res = await subject({
      payload: { input: "   ", expectedOutput: "Sample expected answer" },
    })

    expectResponse(res, 422)
  })

  it("should reject an empty expected output", async () => {
    await createContext()

    const res = await subject({ payload: { input: "Sample question", expectedOutput: "   " } })

    expectResponse(res, 422)
  })

  it("should return 404 for a non-existent dataset", async () => {
    await createContext()
    datasetId = randomUUID()

    const res = await subject({
      payload: { input: "Sample question", expectedOutput: "Sample expected answer" },
    })

    expectResponse(res, 404)
  })
})
