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
import { createRunWithCsvDataset } from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
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

describe("Evaluation extraction runs - deleteOne", () => {
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
    const { dataset, datasetRecords, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    evaluationExtractionRunId = run.id
    return { organization, project, agent, agentSettings, dataset, datasetRecords, run }
  }

  const subject = () =>
    request({
      route: EvalExtractionRunsRoutes.deleteOne,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      token: "token",
    })

  it("deletes the run with its records and records the activity", async () => {
    const { organization, project, datasetRecords, run } = await createContext()
    await repositories.evaluationExtractionRunRecordRepository.save(
      evaluationExtractionRunRecordFactory
        .transient({
          organization,
          project,
          evaluationExtractionRun: run,
          evaluationExtractionDatasetRecord: datasetRecords[0],
        })
        .build(),
    )

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.deleteOne, response)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await repositories.evaluationExtractionRunRepository.count()).toBe(0)
    expect(await repositories.evaluationExtractionRunRecordRepository.count()).toBe(0)
    await expectActivityCreated("evaluationExtractionRun.delete", { organizationId, projectId })
  })

  it("answers 404 for an unknown run", async () => {
    await createContext()
    evaluationExtractionRunId = randomUUID()
    expectResponse(await subject(), 404)
  })
})
