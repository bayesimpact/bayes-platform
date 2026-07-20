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
import type { ProcessEvaluationConversationRunRecordJobPayload } from "../evaluation-conversation-run.types"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "../evaluation-conversation-run-batch.interface"
import { EvaluationConversationRunRecord } from "../records/evaluation-conversation-run-record.entity"
import { evaluationConversationRunRecordFactory } from "../records/evaluation-conversation-run-record.factory"
import { createRunWithConversationDataset } from "./conversation-dataset.helpers"

describe("EvaluationConversationRuns - retryOne", () => {
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

  const mockRetryRunRecords = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: mockRetryRunRecords,
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
    mockRetryRunRecords.mockClear()
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
    await setup
      .getRepository(EvaluationConversationRun)
      .update({ id: run.id }, { status: "failed" })

    const errorRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecords[0],
      })
      .build({ status: "error", errorDetails: "boom" })
    await setup.getRepository(EvaluationConversationRunRecord).save(errorRecord)

    const gradedRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecords[1],
      })
      .build({ status: "graded", output: "answer", score: 80 })
    await setup.getRepository(EvaluationConversationRunRecord).save(gradedRecord)

    const cancelledRecord = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecords[2],
      })
      .build({ status: "cancelled" })
    await setup.getRepository(EvaluationConversationRunRecord).save(cancelledRecord)

    return { organization, project, run, errorRecord, gradedRecord, cancelledRecord }
  }

  const subject = async () =>
    request({
      route: EvaluationConversationRunsRoutes.retryOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationConversationRunId }),
      token: accessToken,
    })

  it("sets the run back to running and re-enqueues error/cancelled records only", async () => {
    const { errorRecord, gradedRecord, cancelledRecord } = await createContext()

    const res = await subject()

    expectResponse(res, 201)

    const run = await setup
      .getRepository(EvaluationConversationRun)
      .findOneBy({ id: evaluationConversationRunId })
    expect(run?.status).toBe("running")
    expect(run?.summary).toEqual({
      total: 3,
      graded: 1,
      errors: 0,
      running: 2,
      averageScore: 80,
    })

    expect(mockRetryRunRecords).toHaveBeenCalledTimes(1)
    const retriedPayloads = mockRetryRunRecords.mock
      .calls[0]![0] as ProcessEvaluationConversationRunRecordJobPayload[]
    expect(retriedPayloads.map((payload) => payload.runRecordId).sort()).toEqual(
      [errorRecord.id, cancelledRecord.id].sort(),
    )

    // Retried records are reset to "running" with the previous attempt cleared.
    const runRecordRepository = setup.getRepository(EvaluationConversationRunRecord)
    for (const retriedRecordId of [errorRecord.id, cancelledRecord.id]) {
      const retriedRecord = await runRecordRepository.findOneByOrFail({ id: retriedRecordId })
      expect(retriedRecord.status).toBe("running")
      expect(retriedRecord.output).toBeNull()
      expect(retriedRecord.score).toBeNull()
      expect(retriedRecord.errorDetails).toBeNull()
      expect(retriedRecord.traceId).toBeNull()
    }

    // Graded records are left untouched.
    const untouchedRecord = await runRecordRepository.findOneByOrFail({ id: gradedRecord.id })
    expect(untouchedRecord.status).toBe("graded")
    expect(untouchedRecord.score).toBe(80)

    await expectActivityCreated("evaluationConversationRun.retry")
  })

  it("is a no-op when the run has no error or cancelled records", async () => {
    const { errorRecord, cancelledRecord } = await createContext()
    const runRecordRepository = setup.getRepository(EvaluationConversationRunRecord)
    await runRecordRepository.update({ id: errorRecord.id }, { status: "graded", score: 100 })
    await runRecordRepository.update({ id: cancelledRecord.id }, { status: "graded", score: 100 })
    await setup
      .getRepository(EvaluationConversationRun)
      .update({ id: evaluationConversationRunId }, { status: "completed" })

    const res = await subject()

    expectResponse(res, 201)
    expect(mockRetryRunRecords).not.toHaveBeenCalled()

    const run = await setup
      .getRepository(EvaluationConversationRun)
      .findOneBy({ id: evaluationConversationRunId })
    expect(run?.status).toBe("completed")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    evaluationConversationRunId = "00000000-0000-0000-0000-000000000000"

    const res = await subject()

    expectResponse(res, 404)
  })
})
