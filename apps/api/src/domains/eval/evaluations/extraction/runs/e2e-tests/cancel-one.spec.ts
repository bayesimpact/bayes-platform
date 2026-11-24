import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalExtractionRunsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithCsvDataset } from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
import { EVALUATION_EXTRACTION_RUN_BATCH_SERVICE } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run-batch.interface"
import { evaluationExtractionRunRecordFactory } from "@/domains/evaluations/extraction/runs/records/evaluation-extraction-run-record.factory"
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

const KEY_MAPPING = [
  { agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" as const },
]

const mockRemovePendingRunRecords = jest.fn().mockResolvedValue(undefined)

describe("Evaluation extraction runs - cancelOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let evaluationExtractionRunId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EVALUATION_EXTRACTION_RUN_BATCH_SERVICE)
          .useValue({
            enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
            removePendingExecuteRun: jest.fn().mockResolvedValue(undefined),
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
    authSubject = `oidc|${randomUUID()}`
    mockRemovePendingRunRecords.mockClear()
    mockRemovePendingRunRecords.mockResolvedValue(undefined)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A run of an extraction agent over a CSV dataset, pending until a test changes it. */
  const createContext = async (agentType: "conversation" | "extraction" = "extraction") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
        agent: { type: agentType },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
          model: AgentModel._Mock,
          instructions: "Published instructions",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    const { datasetRecords, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    evaluationExtractionRunId = run.id
    const runningRecord = await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: datasetRecords[0],
        })
        .build({ status: "running" }),
    )
    return { organization, project, agent, agentSettings, runningRecord }
  }

  const subject = () =>
    request({
      route: EvalExtractionRunsRoutes.cancelOne,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      token: "token",
    })

  const setRunStatus = (status: "running" | "completed" | "cancelled") =>
    repositories.evaluationExtractionRunRepository.update(evaluationExtractionRunId, { status })

  it("cancels a pending run and records the activity", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.cancelOne, response, 201)
    expect(response.body.data).toMatchObject({
      id: evaluationExtractionRunId,
      status: "cancelled",
    })
    const run = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: evaluationExtractionRunId,
    })
    expect(run.status).toBe("cancelled")
    await expectActivityCreated("evaluationExtractionRun.cancel", { organizationId, projectId })
  })

  it("cancels a running run and its running records", async () => {
    const { runningRecord } = await createContext()
    await setRunStatus("running")

    expectSchemaResponse(EvalExtractionRunsRoutes.cancelOne, await subject(), 201)

    const record = await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
      id: runningRecord.id,
    })
    expect(record.status).toBe("cancelled")
  })

  it("still cancels the run when its pending jobs cannot be removed", async () => {
    await createContext()
    mockRemovePendingRunRecords.mockRejectedValue(new Error("The queue is down"))

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.cancelOne, response, 201)
    expect(response.body.data.status).toBe("cancelled")
  })

  it.each(["completed", "cancelled"] as const)("answers 422 for a %s run", async (status) => {
    await createContext()
    await setRunStatus(status)

    expectResponse(await subject(), 422)
  })

  it("answers 404 for an unknown run", async () => {
    await createContext()
    evaluationExtractionRunId = randomUUID()
    expectResponse(await subject(), 404)
  })
})
