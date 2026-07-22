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
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "../evaluation-conversation-run-batch.interface"
import { EvaluationConversationRunRecord } from "../records/evaluation-conversation-run-record.entity"
import { evaluationConversationRunRecordFactory } from "../records/evaluation-conversation-run-record.factory"
import { createRunWithConversationDataset } from "./conversation-dataset.helpers"

describe("EvaluationConversationRuns - cancelOne", () => {
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

  const mockRemovePendingRunRecords = jest.fn().mockResolvedValue(undefined)
  const mockRemovePendingExecuteRun = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            removePendingExecuteRun: mockRemovePendingExecuteRun,
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: jest.fn().mockResolvedValue(undefined),
            removePendingRunRecords: mockRemovePendingRunRecords,
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
    mockRemovePendingRunRecords.mockClear()
    mockRemovePendingRunRecords.mockResolvedValue(undefined)
    mockRemovePendingExecuteRun.mockClear()
    mockRemovePendingExecuteRun.mockResolvedValue(undefined)
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
        agentSettings: { model: AgentModel._Mock },
      },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const { run, datasetRecords } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    evaluationConversationRunId = run.id

    // A still-running record so the cancel path has something to transition to "cancelled".
    const runningRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecords[0],
      })
      .build({ status: "running" })
    await setup.getRepository(EvaluationConversationRunRecord).save(runningRecord)

    return { organization, project, run, runningRecord }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.cancelOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
    })

  it("cancels a pending run", async () => {
    await createContext()

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("cancelled")

    const run = await setup
      .getRepository(EvaluationConversationRun)
      .findOneBy({ id: evaluationConversationRunId })
    expect(run?.status).toBe("cancelled")

    // The pending execute-run job is removed so the starter cannot fan the
    // cancelled run out afterwards.
    expect(mockRemovePendingExecuteRun).toHaveBeenCalledWith(evaluationConversationRunId)

    await expectActivityCreated("evaluationConversationRun.cancel")
  })

  it("cancels a running run and marks its running records cancelled", async () => {
    const { run, runningRecord } = await createContext()
    await setup
      .getRepository(EvaluationConversationRun)
      .update({ id: run.id }, { status: "running" })

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("cancelled")

    const record = await setup
      .getRepository(EvaluationConversationRunRecord)
      .findOneBy({ id: runningRecord.id })
    expect(record?.status).toBe("cancelled")
  })

  it("still cancels the run when removing pending jobs fails", async () => {
    const { runningRecord } = await createContext()
    mockRemovePendingRunRecords.mockRejectedValueOnce(new Error("redis down"))

    const res = await subject()

    expectResponse(res, 201)
    expect(res.body.data.status).toBe("cancelled")

    const record = await setup
      .getRepository(EvaluationConversationRunRecord)
      .findOneBy({ id: runningRecord.id })
    expect(record?.status).toBe("cancelled")
  })

  it("rejects cancelling a completed run", async () => {
    const { run } = await createContext()
    await setup
      .getRepository(EvaluationConversationRun)
      .update({ id: run.id }, { status: "completed" })

    const res = await subject()

    expectResponse(res, 422)
  })

  it("rejects cancelling an already-cancelled run", async () => {
    const { run } = await createContext()
    await setup
      .getRepository(EvaluationConversationRun)
      .update({ id: run.id }, { status: "cancelled" })

    const res = await subject()

    expectResponse(res, 422)
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    evaluationConversationRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
