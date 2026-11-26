import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { EvalConversationRunsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
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

describe("Evaluation conversation runs - getOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationConversationRunId: string
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
    const { dataset, run } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    organizationId = organization.id
    projectId = project.id
    evaluationConversationRunId = run.id
    return { organization, project, agent, agentSettings, dataset, run }
  }

  const subject = () =>
    request({
      route: EvalConversationRunsRoutes.getOne,
      pathParams: { organizationId, projectId, evaluationConversationRunId },
      token: "token",
    })

  it("returns the run with the version it pinned, after the agent got a newer one", async () => {
    const { organization, project, agent, agentSettings, dataset, run } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, instructions: "Newer helpful assistant instructions" }),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.getOne, response)
    expect(response.body.data).toStrictEqual({
      id: run.id,
      evaluationConversationDatasetId: dataset.id,
      agentId: agent.id,
      agentSettings: {
        instructions: agentSettings.instructions,
        model: agentSettings.model,
        revision: agentSettings.revision,
        providerOptions: agentSettings.providerOptions,
        documentsRagMode: agentSettings.documentsRagMode,
      },
      status: "pending",
      judgeModel: run.judgeModel,
      judgeInstructions: run.judgeInstructions,
      summary: null,
      createdAt: run.createdAt.getTime(),
      updatedAt: run.updatedAt.getTime(),
    })
  })

  it("returns a failed run with its error fields", async () => {
    const { run } = await createContext()
    const summary = { averageScore: null, errors: 3, graded: 0, running: 0, total: 3 }
    await repositories.evaluationConversationRunRepository.update(run.id, {
      status: "failed",
      summary,
    })

    const response = await subject()

    expect(response.body.data).toMatchObject({ status: "failed", summary })
    expectSchemaResponse(EvalConversationRunsRoutes.getOne, response)
  })
})
