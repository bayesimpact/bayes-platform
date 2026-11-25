import { randomUUID } from "node:crypto"
import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createRunWithConversationDataset } from "@/domains/evaluations/conversation/runs/e2e-tests/conversation-dataset.helpers"
import { evaluationConversationRunFactory } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.factory"
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

describe("Evaluation conversation runs - getAll", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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
    const context = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      projectMembership: OWNER_EVALUATOR_PROJECT_MEMBERSHIP,
      agent: { type: "conversation" },
      agentSettings: { model: AgentModel._Mock },
    })
    organizationId = context.organization.id
    projectId = context.project.id
    return context
  }

  const subject = () =>
    request({
      route: EvalConversationRunsRoutes.getAll,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns an empty list when the project has no run", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.getAll, response)
    expect(response.body.data).toEqual([])
  })

  it("returns the runs of the project, newest first, with their pinned version", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const { dataset, run: olderRun } = await createRunWithConversationDataset({
      getRepository: setup.getRepository,
      organization,
      project,
      agent,
      agentSettings,
    })
    await repositories.evaluationConversationRunRepository.update(olderRun.id, {
      createdAt: new Date("2024-01-01"),
    })
    const newerRun = await repositories.evaluationConversationRunRepository.save(
      evaluationConversationRunFactory
        .transient({
          organization,
          project,
          agent,
          agentSettings,
          evaluationConversationDataset: dataset,
        })
        .build({ status: "completed" }),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationRunsRoutes.getAll, response)
    expect(response.body.data.map((run) => run.id)).toEqual([newerRun.id, olderRun.id])
    expect(response.body.data[0]).toMatchObject({
      evaluationConversationDatasetId: dataset.id,
      agentId: agent.id,
      status: "completed",
      agentSettings: { revision: agentSettings.revision, model: AgentModel._Mock },
    })
  })
})
