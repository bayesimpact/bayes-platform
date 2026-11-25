import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalExtractionRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithCsvDataset } from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
import {
  createOrganizationWithAgent,
  OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

const KEY_MAPPING = [
  { agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" as const },
]

describe("Evaluation extraction runs - getAll", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let _evaluationExtractionRunId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
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
    return { organization, project, agent, agentSettings }
  }

  const subject = () =>
    request({
      route: EvalExtractionRunsRoutes.getAll,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns an empty list when the project has no run", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getAll, response)
    expect(response.body.data).toStrictEqual([])
  })

  it("returns the runs of the project with their pinned revision, the newest first", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const { run: olderRun } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    const { run: newerRun } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    await repositories.evaluationExtractionRunRepository.update(olderRun.id, {
      createdAt: new Date("2024-01-01"),
    })
    await repositories.evaluationExtractionRunRepository.update(newerRun.id, {
      createdAt: new Date("2024-06-01"),
    })

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getAll, response)
    expect(response.body.data.map((run) => run.id)).toEqual([newerRun.id, olderRun.id])
    expect(response.body.data[0]).toMatchObject({
      evaluationExtractionDatasetId: newerRun.evaluationExtractionDatasetId,
      agentId: agent.id,
      agentRevision: agentSettings.revision,
      keyMapping: KEY_MAPPING,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
    })
  })
})
