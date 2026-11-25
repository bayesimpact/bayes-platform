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
import type { ProcessEvaluationConversationRunRecordJobPayload } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.types"
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

describe("Evaluation conversation runs - retryOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
  let authSubject = `oidc|${randomUUID()}`

  const mockRetryRunRecords = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_CONVERSATION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            removePendingExecuteRun: jest.fn().mockResolvedValue(undefined),
            enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
            retryRunRecords: mockRetryRunRecords,
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
    mockRetryRunRecords.mockClear()
    mockRetryRunRecords.mockResolvedValue(undefined)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A failed run with a record in error, a graded record and a cancelled record. */
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
    await repositories.evaluationConversationRunRepository.update(run.id, { status: "failed" })
    const [errorRecord, gradedRecord, cancelledRecord] =
      await repositories.evaluationConversationRunRecordRepository.save(
        datasetRecords.map((datasetRecord, index) =>
          evaluationConversationRunRecordFactory
            .transient({
              organization,
              project,
              evaluationConversationRun: run,
              evaluationConversationDatasetRecord: datasetRecord,
            })
            .build(
              [
                {
                  status: "error" as const,
                  errorDetails: "The model did not answer",
                  formState: { title: "Previous attempt" },
                },
                {
                  status: "graded" as const,
                  output: "An answer",
                  score: 4,
                  formState: { title: "Saved result" },
                },
                { status: "cancelled" as const, formState: { title: "Cancelled attempt" } },
              ][index],
            ),
        ),
      )
    if (!errorRecord || !gradedRecord || !cancelledRecord)
      throw new Error("The helper saves three dataset records")
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
    return { errorRecord, gradedRecord, cancelledRecord }
  }

  const subject = () =>
    request({
      route: EvalConversationRunsRoutes.retryOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      token: "token",
    })

  it("asks again the records in error or cancelled and records the activity", async () => {
    const { errorRecord, gradedRecord, cancelledRecord } = await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.retryOne, response, 201)
    // As the old endpoint, the answer is the run as the request found it.
    expect(response.body.data).toMatchObject({ id: evaluationConversationRunId, status: "failed" })
    const run = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: evaluationConversationRunId,
    })
    expect(run.status).toBe("running")
    expect(run.summary).toEqual({ total: 3, graded: 1, errors: 0, running: 2, averageScore: 4 })
    expect(mockRetryRunRecords).toHaveBeenCalledTimes(1)
    const retriedPayloads = mockRetryRunRecords.mock
      .calls[0]?.[0] as ProcessEvaluationConversationRunRecordJobPayload[]
    expect(retriedPayloads.map((payload) => payload.runRecordId).sort()).toEqual(
      [errorRecord.id, cancelledRecord.id].sort(),
    )
    // A record that is asked again loses what its last attempt left.
    for (const retriedRecordId of [errorRecord.id, cancelledRecord.id]) {
      const retriedRecord =
        await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
          id: retriedRecordId,
        })
      expect(retriedRecord).toMatchObject({
        status: "running",
        output: null,
        formState: null,
        score: null,
        errorDetails: null,
        traceId: null,
      })
    }
    const untouchedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: gradedRecord.id,
      })
    expect(untouchedRecord).toMatchObject({
      status: "graded",
      score: 4,
      formState: { title: "Saved result" },
    })
    await expectActivityCreated("evaluationConversationRun.retry", { organizationId, projectId })
  })

  it("answers 422 and restores the run and its records when the jobs cannot be queued", async () => {
    const { errorRecord, gradedRecord, cancelledRecord } = await createContext()
    mockRetryRunRecords.mockRejectedValueOnce(new Error("The queue is down"))

    expectResponse(await subject(), 422)

    const run = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: evaluationConversationRunId,
    })
    expect(run.status).toBe("failed")
    // A record left "running" with no job could be neither asked again nor cancelled.
    const runRecordRepository = repositories.evaluationConversationRunRecordRepository
    expect(await runRecordRepository.findOneByOrFail({ id: errorRecord.id })).toMatchObject({
      status: "error",
      errorDetails: "The model did not answer",
      formState: { title: "Previous attempt" },
    })
    expect(await runRecordRepository.findOneByOrFail({ id: cancelledRecord.id })).toMatchObject({
      status: "cancelled",
      formState: { title: "Cancelled attempt" },
    })
    expect(await runRecordRepository.findOneByOrFail({ id: gradedRecord.id })).toMatchObject({
      status: "graded",
    })

    // A second try works on the restored records.
    expectSchemaResponse(EvalConversationRunsRoutes.retryOne, await subject(), 201)
    const retriedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: evaluationConversationRunId,
    })
    expect(retriedRun.status).toBe("running")
  })

  it("queues nothing and leaves the run when no record is in error or cancelled", async () => {
    const { errorRecord, cancelledRecord } = await createContext()
    const runRecordRepository = repositories.evaluationConversationRunRecordRepository
    await runRecordRepository.update({ id: errorRecord.id }, { status: "graded", score: 5 })
    await runRecordRepository.update({ id: cancelledRecord.id }, { status: "graded", score: 5 })
    await repositories.evaluationConversationRunRepository.update(evaluationConversationRunId, {
      status: "completed",
    })

    expectSchemaResponse(EvalConversationRunsRoutes.retryOne, await subject(), 201)

    expect(mockRetryRunRecords).not.toHaveBeenCalled()
    const run = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: evaluationConversationRunId,
    })
    expect(run.status).toBe("completed")
  })
})
