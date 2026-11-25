import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalConversationRunsRoutes } from "@bayes-platform/eval-contracts"
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
import { evaluationConversationRunRecordFactory } from "@/domains/evaluations/conversation/runs/records/evaluation-conversation-run-record.factory"
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

describe("Evaluation conversation runs - cancelOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let authSubject = `oidc|${randomUUID()}`

  const mockRemovePendingRunRecords = jest.fn().mockResolvedValue(undefined)
  const mockRemovePendingExecuteRun = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            removePendingExecuteRun: mockRemovePendingExecuteRun,
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: jest.fn().mockResolvedValue(undefined),
            removePendingRunRecords: mockRemovePendingRunRecords,
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
    mockRemovePendingRunRecords.mockClear()
    mockRemovePendingRunRecords.mockResolvedValue(undefined)
    mockRemovePendingExecuteRun.mockClear()
    mockRemovePendingExecuteRun.mockResolvedValue(undefined)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A pending run with one record still running. */
  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
      },
    )
    const { run, datasetRecords } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    const [datasetRecord] = datasetRecords
    if (!datasetRecord) throw new Error("The helper saves three dataset records")
    const runningRecord = await repositories.evaluationConversationRunRecordRepository.save(
      evaluationConversationRunRecordFactory
        .transient({
          organization,
          project,
          evaluationConversationRun: run,
          evaluationConversationDatasetRecord: datasetRecord,
        })
        .build({ status: "running" }),
    )
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
    return { runningRecord }
  }

  const subject = () =>
    request({
      route: EvalConversationRunsRoutes.cancelOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      token: "token",
    })

  const setRunStatus = (status: "running" | "completed" | "cancelled") =>
    repositories.evaluationConversationRunRepository.update(evaluationConversationRunId, {
      status,
    })

  it("cancels a pending run, removes its pending job and records the activity", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.cancelOne, response, 201)
    expect(response.body.data).toMatchObject({
      id: evaluationConversationRunId,
      status: "cancelled",
    })
    const run = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: evaluationConversationRunId,
    })
    expect(run.status).toBe("cancelled")
    expect(mockRemovePendingExecuteRun).toHaveBeenCalledWith(evaluationConversationRunId)
    await expectActivityCreated("evaluationConversationRun.cancel", { organizationId, projectId })
  })

  it("cancels a running run and its running records", async () => {
    const { runningRecord } = await createContext()
    await setRunStatus("running")

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.cancelOne, response, 201)
    expect(response.body.data.status).toBe("cancelled")
    const record = await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
      id: runningRecord.id,
    })
    expect(record.status).toBe("cancelled")
  })

  it("still cancels the run when its pending jobs cannot be removed", async () => {
    const { runningRecord } = await createContext()
    mockRemovePendingRunRecords.mockRejectedValueOnce(new Error("The queue is down"))

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.cancelOne, response, 201)
    expect(response.body.data.status).toBe("cancelled")
    const record = await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
      id: runningRecord.id,
    })
    expect(record.status).toBe("cancelled")
  })

  it.each(["completed", "cancelled"] as const)("answers 422 for a %s run", async (status) => {
    await createContext()
    await setRunStatus(status)

    expectResponse(await subject(), 422)
  })
})
