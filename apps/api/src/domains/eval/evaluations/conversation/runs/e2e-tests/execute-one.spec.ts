import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run-batch.interface"
import {
  createOrganizationWithAgent,
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

describe("Evaluation conversation runs - executeOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let authSubject = `oidc|${randomUUID()}`

  const mockEnqueueExecuteRun = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: mockEnqueueExecuteRun,
            removePendingExecuteRun: jest.fn().mockResolvedValue(undefined),
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: jest.fn().mockResolvedValue(undefined),
            removePendingRunRecords: jest.fn().mockResolvedValue(undefined),
          }),
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
    mockEnqueueExecuteRun.mockClear()
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
        agentSettings: { model: AgentModel._Mock, instructions: "Answer the question" },
      },
    )
    const { run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
  }

  const subject = (recordLimit: number | null) =>
    request({
      route: EvalConversationRunsRoutes.executeOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      body: { payload: { recordLimit } },
      token: "token",
    })

  it("enqueues the run, returns it as pending and records the activity", async () => {
    await createContext()

    const response = await subject(null)

    expectSchemaResponse(EvalConversationRunsRoutes.executeOne, response, 201)
    expect(response.body.data).toMatchObject({
      id: evaluationConversationRunId,
      status: "pending",
      summary: null,
    })
    expect(mockEnqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationConversationRunId,
      organizationId,
      projectId,
      recordLimit: null,
    })
    await expectActivityCreated("evaluationConversationRun.execute", { organizationId, projectId })
  })

  it("passes the record limit to the job", async () => {
    await createContext()

    expectSchemaResponse(EvalConversationRunsRoutes.executeOne, await subject(2), 201)
    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationConversationRunId,
      organizationId,
      projectId,
      recordLimit: 2,
    })
  })

  // The old endpoint answered 422 for a record limit under 1, and took a missing body as no
  // limit: the schema now refuses them.
  it.each([0, -3])("answers 400 for a record limit of %i and enqueues nothing", async (limit) => {
    await createContext()

    expectResponse(await subject(limit), 400)
    expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("answers 400 without a body and enqueues nothing", async () => {
    await createContext()

    const response = await request({
      route: EvalConversationRunsRoutes.executeOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      token: "token",
    })

    expectResponse(response, 400)
    expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
  })
})
