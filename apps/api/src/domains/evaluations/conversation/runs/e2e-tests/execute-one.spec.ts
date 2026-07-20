import { randomUUID } from "node:crypto"
import { AgentModel, EvaluationConversationRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "../evaluation-conversation-run-batch.interface"
import { createRunWithConversationDataset } from "./conversation-dataset.helpers"

describe("EvaluationConversationRuns - executeOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const mockEnqueueExecuteRun = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: mockEnqueueExecuteRun,
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: jest.fn().mockResolvedValue(undefined),
            removePendingRunRecords: jest.fn().mockResolvedValue(undefined),
          }),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockEnqueueExecuteRun.mockClear()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
        agent: { type: "conversation" },
        agentSettings: {
          model: AgentModel._Mock,
          instructions: "Answer the question",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const { dataset, datasetRecords, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    evaluationConversationRunId = run.id

    return { organization, project, agent, dataset, datasetRecords, run }
  }

  const subject = async (recordLimit: number | null) =>
    request({
      route: EvaluationConversationRunsRoutes.executeOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
      request: { payload: { recordLimit } },
    })

  it("enqueues an execute-run job and returns the run as pending", async () => {
    await createContext()

    const res = await subject(null)

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("pending")
    expect(res.body.data.summary).toBeNull()
    expect(mockEnqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationConversationRunId,
      organizationId,
      projectId,
      recordLimit: null,
    })

    await expectActivityCreated("evaluationConversationRun.execute")
  })

  it("forwards recordLimit to the enqueued job", async () => {
    await createContext()

    const res = await subject(2)

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("pending")
    expect(mockEnqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationConversationRunId,
      organizationId,
      projectId,
      recordLimit: 2,
    })
  })

  it("rejects a recordLimit of zero", async () => {
    await createContext()

    const res = await subject(0)

    expectResponse(res, 422)
    expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("rejects a negative recordLimit", async () => {
    await createContext()

    const res = await subject(-3)

    expectResponse(res, 422)
    expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("should return 404 for a non-existent run", async () => {
    await createContext()
    evaluationConversationRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject(null)

    expectResponse(res, 404)
  })
})
