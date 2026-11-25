import { randomUUID } from "node:crypto"
import {
  CONVERSATION_DATASET_RECORD_MAX_LENGTH,
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

describe("Evaluation conversation datasets - createRecords", () => {
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

  const subject = (records: ConversationDatasetRecordInputDto[]) =>
    request({
      route: EvalConversationDatasetsRoutes.createRecords,
      pathParams: { organizationId, projectId, datasetId },
      body: { payload: { records } },
      token: "token",
    })

  it("adds several records in one call and records the activity", async () => {
    await createContext()

    const response = await subject([
      { input: "Question 1", expectedOutput: "Answer 1" },
      { input: "Question 2", expectedOutput: "Answer 2" },
      { input: "Question 3", expectedOutput: "Answer 3" },
    ])

    expectSchemaResponse(EvalConversationDatasetsRoutes.createRecords, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    const records = await repositories.evaluationConversationDatasetRecordRepository.find()
    expect(records.map((record) => record.input).sort()).toEqual([
      "Question 1",
      "Question 2",
      "Question 3",
    ])
    for (const record of records) {
      expect(record).toMatchObject({
        evaluationConversationDatasetId: datasetId,
        organizationId,
        projectId,
      })
    }
    await expectActivityCreated("evaluationConversationDataset.createRecords", {
      organizationId,
      projectId,
    })
  })

  // The old endpoint answered 422 for each of these: the schema now refuses them.
  it.each<[string, ConversationDatasetRecordInputDto[]]>([
    ["no record", []],
    [
      "a blank input",
      [
        { input: "Question 1", expectedOutput: "Answer 1" },
        { input: "   ", expectedOutput: "Answer 2" },
      ],
    ],
    [
      "a blank expected output",
      [
        { input: "Question 1", expectedOutput: "Answer 1" },
        { input: "Question 2", expectedOutput: "   " },
      ],
    ],
    [
      "an input that is too long",
      [
        { input: "Question 1", expectedOutput: "Answer 1" },
        {
          input: "a".repeat(CONVERSATION_DATASET_RECORD_MAX_LENGTH + 1),
          expectedOutput: "Answer 2",
        },
      ],
    ],
  ])("answers 400 for %s and adds nothing", async (_case, records) => {
    await createContext()

    expectResponse(await subject(records), 400)
    expect(await repositories.evaluationConversationDatasetRecordRepository.count()).toBe(0)
  })
})
