import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalExtractionRunsRoutes } from "@caseai-connect/eval-contracts"
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

describe("Evaluation extraction runs - getOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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
    const { dataset, run } = await createRunWithCsvDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
      keyMapping: KEY_MAPPING,
    })
    evaluationExtractionRunId = run.id
    return { organization, project, agent, agentSettings, dataset, run }
  }

  const subject = () =>
    request({
      route: EvalExtractionRunsRoutes.getOne,
      pathParams: { organizationId, projectId, evaluationExtractionRunId },
      token: "token",
    })

  it("returns the run", async () => {
    const { agent, agentSettings, dataset, run } = await createContext()

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getOne, response)
    expect(response.body.data).toStrictEqual({
      id: run.id,
      evaluationExtractionDatasetId: dataset.id,
      agentId: agent.id,
      agentRevision: agentSettings.revision,
      keyMapping: KEY_MAPPING,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
      createdAt: run.createdAt.getTime(),
      updatedAt: run.updatedAt.getTime(),
    })
  })

  it("returns the summary of a completed run", async () => {
    await createContext()
    const summary = { total: 3, perfectMatches: 2, mismatches: 1, errors: 0, running: 0 }
    await repositories.evaluationExtractionRunRepository.update(evaluationExtractionRunId, {
      status: "completed",
      summary,
    })

    const response = await subject()

    expectSchemaResponse(EvalExtractionRunsRoutes.getOne, response)
    expect(response.body.data).toMatchObject({ status: "completed", summary })
  })

  it("answers 404 for an unknown run", async () => {
    await createContext()
    evaluationExtractionRunId = randomUUID()
    expectResponse(await subject(), 404)
  })
})
