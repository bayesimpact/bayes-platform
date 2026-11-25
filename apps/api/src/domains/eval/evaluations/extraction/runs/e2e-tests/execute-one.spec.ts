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

const mockEnqueueExecuteRun = jest.fn().mockResolvedValue(undefined)

describe("Evaluation extraction runs - executeOne", () => {
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
    authSubject = `oidc|${randomUUID()}`
    mockEnqueueExecuteRun.mockClear()
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
    const { run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    evaluationExtractionRunId = run.id
    return { organization, project, agent, agentSettings, run }
  }

  const subject = (payload: unknown = { recordLimit: null }) =>
    request({
      route: EvalExtractionRunsRoutes.executeOne,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      body: { payload },
      token: "token",
    })

  it("enqueues an execute job without limit, answers the pending run and records the activity", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.executeOne, response, 201)
    expect(response.body.data).toMatchObject({
      id: evaluationExtractionRunId,
      status: "pending",
      summary: null,
    })
    expect(mockEnqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationExtractionRunId,
      organizationId,
      projectId,
      recordLimit: null,
    })
    await expectActivityCreated("evaluationExtractionRun.execute", { organizationId, projectId })
  })

  it("forwards the record limit to the job", async () => {
    await createContext()

    expectSchemaResponse(
      EvalExtractionRunsRoutes.executeOne,
      await subject({ recordLimit: 2 }),
      201,
    )

    expect(mockEnqueueExecuteRun).toHaveBeenCalledWith({
      evaluationExtractionRunId,
      organizationId,
      projectId,
      recordLimit: 2,
    })
  })

  // The old endpoint took a missing body as no limit, and answered 422 for a limit under 1.
  it("answers 400 for a record limit under 1, and for a body without recordLimit", async () => {
    await createContext()

    expectResponse(await subject({ recordLimit: 0 }), 400)
    expectResponse(await subject({}), 400)
    expect(mockEnqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("answers 404 for an unknown run", async () => {
    await createContext()
    evaluationExtractionRunId = randomUUID()
    expectResponse(await subject(), 404)
  })
})
