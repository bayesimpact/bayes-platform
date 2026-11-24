import { randomUUID } from "node:crypto"
import {
  type ConversationDatasetRecordInputDto,
  EvalConversationDatasetsRoutes,
} from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
import {
  createOrganizationWithProject,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

describe("Evaluation conversation datasets - createRecord", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let datasetId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
    })
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
  }

  const subject = (payload: ConversationDatasetRecordInputDto) =>
    request({
      route: EvalConversationDatasetsRoutes.createRecord,
      pathParams: { organizationId, projectId, datasetId },
      body: { payload },
      token: "token",
    })

  it("adds a record to the dataset and records the activity", async () => {
    await createContext()

    const response = await subject({ input: "Sample question", expectedOutput: "Sample answer" })

    expectSchemaResponse(EvalConversationDatasetsRoutes.createRecord, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    const records = await repositories.evaluationConversationDatasetRecordRepository.find()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      input: "Sample question",
      expectedOutput: "Sample answer",
      evaluationConversationDatasetId: datasetId,
      organizationId,
      projectId,
    })
    await expectActivityCreated("evaluationConversationDataset.createRecord", {
      organizationId,
      projectId,
    })
  })

  // The old endpoint answered 422 for a blank input or expected output: the schema now refuses it.
  it.each<ConversationDatasetRecordInputDto>([
    { input: "   ", expectedOutput: "Sample answer" },
    { input: "Sample question", expectedOutput: "   " },
  ])("answers 400 for a blank field and adds nothing (%o)", async (payload) => {
    await createContext()

    expectResponse(await subject(payload), 400)
    expect(await repositories.evaluationConversationDatasetRecordRepository.count()).toBe(0)
  })
})
