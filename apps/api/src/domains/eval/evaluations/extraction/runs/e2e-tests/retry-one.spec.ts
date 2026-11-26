import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalExtractionRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
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

const mockRetryRunRecords = jest.fn().mockResolvedValue(undefined)

describe("Evaluation extraction runs - retryOne", () => {
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
    authSubject = `oidc|${randomUUID()}`
    mockRetryRunRecords.mockClear()
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
    const [firstDatasetRecord] = datasetRecords
    await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: firstDatasetRecord,
        })
        .build({ status: "error" }),
    )
    return { organization, project, agent, agentSettings, run }
  }

  const subject = () =>
    request({
      route: EvalExtractionRunsRoutes.retryOne,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      token: "token",
    })

  it("retries the records with the version the run is pinned to and records the activity", async () => {
    const { agentSettings } = await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.retryOne, response, 201)
    expect(response.body.data.id).toBe(evaluationExtractionRunId)
    expect(mockRetryRunRecords).toHaveBeenCalledTimes(1)
    const [payloads] = mockRetryRunRecords.mock.calls[0]
    expect(payloads).toHaveLength(1)
    expect(payloads[0].agentWithSettings.settings).toMatchObject({
      revision: agentSettings.revision,
      instructions: "Published instructions",
    })
    await expectActivityCreated("evaluationExtractionRun.retry", { organizationId, projectId })
  })

  it("doesn't retry with a newer draft revision", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1, instructions: "Draft instructions" }),
    )

    expectSchemaResponse(EvalExtractionRunsRoutes.retryOne, await subject(), 201)

    const [payloads] = mockRetryRunRecords.mock.calls[0]
    expect(payloads[0].agentWithSettings.settings).toMatchObject({
      revision: agentSettings.revision,
      instructions: "Published instructions",
    })
  })

  it("answers 404 for an unknown run", async () => {
    await createContext()
    evaluationExtractionRunId = randomUUID()
    expectResponse(await subject(), 404)
  })
})
