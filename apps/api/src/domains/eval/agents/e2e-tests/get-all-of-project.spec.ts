import { randomUUID } from "node:crypto"
import { EvalAgentsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { grantConversationReview } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import { PROJECT_EVALUATOR_ROLE } from "@/domains/rbac/rbac.constants"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation agents - getAllOfProject", () => {
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
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
    })
    organizationId = organization.id
    projectId = project.id
    return { organization, project, user }
  }

  const subject = async () =>
    request({
      route: EvalAgentsRoutes.getAllOfProject,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns the agents sorted by name, with only the fields of the contract", async () => {
    const { organization, project, user } = await createContext()
    const [secondAgent, firstAgent] = await repositories.agentRepository.save([
      agentFactory
        .transient({ organization, project })
        .build({ name: "Support", type: "extraction" }),
      agentFactory
        .transient({ organization, project })
        .build({ name: "Helpful Assistant", type: "conversation" }),
    ])
    if (!firstAgent || !secondAgent) throw new Error("agents not saved")
    await repositories.agentSettingsRepository.save(
      [firstAgent, secondAgent].map((agent) =>
        agentSettingsFactory.production().transient({ organization, project, agent }).build(),
      ),
    )
    await addUserToAgent({ repositories, agent: firstAgent, user })
    await addUserToAgent({ repositories, agent: secondAgent, user })

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data).toStrictEqual([
      { id: firstAgent.id, name: "Helpful Assistant", type: "conversation", projectId: project.id },
      { id: secondAgent.id, name: "Support", type: "extraction", projectId: project.id },
    ])
  })

  it("lists only the agents with a version in production", async () => {
    const { organization, project, user } = await createContext()
    const [publishedAgent, copiedAgent] = await repositories.agentRepository.save([
      agentFactory.transient({ organization, project }).build({ name: "Published Agent" }),
      agentFactory.transient({ organization, project }).build({ name: "Copied Agent" }),
    ])
    if (!publishedAgent || !copiedAgent) throw new Error("agents not saved")
    await repositories.agentSettingsRepository.save([
      agentSettingsFactory
        .production()
        .transient({ organization, project, agent: publishedAgent })
        .build(),
      agentSettingsFactory.draft().transient({ organization, project, agent: copiedAgent }).build(),
    ])
    await addUserToAgent({ repositories, agent: publishedAgent, user })
    await addUserToAgent({ repositories, agent: copiedAgent, user })

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data.map((agent) => agent.name)).toEqual(["Published Agent"])
  })

  it("leaves out the agents a member only reviews", async () => {
    const { organization, project } = await createContext()
    const [usedAgent, reviewedAgent] = await repositories.agentRepository.save([
      agentFactory.transient({ organization, project }).build({ name: "Used Agent" }),
      agentFactory.transient({ organization, project }).build({ name: "Reviewed Agent" }),
    ])
    if (!usedAgent || !reviewedAgent) throw new Error("agents not saved")
    await repositories.agentSettingsRepository.save(
      [usedAgent, reviewedAgent].map((agent) =>
        agentSettingsFactory.production().transient({ organization, project, agent }).build(),
      ),
    )
    const memberAuthSubject = `oidc|${randomUUID()}`
    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: memberAuthSubject },
      projectMembership: { roleKeys: ["project_member"] },
    })
    await addUserToAgent({
      repositories,
      agent: usedAgent,
      user: member,
      membership: { roleKeys: ["agent_member"] },
    })
    await grantConversationReview({ repositories, user: member, agent: reviewedAgent })
    authSubject = memberAuthSubject

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data.map((agent) => agent.name)).toEqual(["Used Agent"])
  })

  it("gives an evaluator the agents of the project", async () => {
    const { organization, project } = await createContext()
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Evaluated Agent" }),
    )
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory.production().transient({ organization, project, agent }).build(),
    )
    const evaluatorAuthSubject = `oidc|${randomUUID()}`
    await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "evaluator@example.com", authSubject: evaluatorAuthSubject },
      projectMembership: { roleKeys: ["project_member", PROJECT_EVALUATOR_ROLE] },
    })
    authSubject = evaluatorAuthSubject

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data.map((listedAgent) => listedAgent.name)).toEqual(["Evaluated Agent"])
  })

  it("returns an empty list when the project has no agent", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data).toEqual([])
  })
})
