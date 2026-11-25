import { randomUUID } from "node:crypto"
import { AGENT_SCOPED_PERMISSIONS } from "@bayes-platform/api-contracts"
import { DeskAgentsRoutes } from "@bayes-platform/desk-contracts"
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
import { AGENT_ROLE_PERMISSIONS, PROJECT_EVALUATOR_ROLE } from "@/domains/rbac/rbac.constants"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

/** The keys of an agent's `permissions` an agent role grants. */
const exposedPermissionsOf = (roleKey: keyof typeof AGENT_ROLE_PERMISSIONS): string[] => {
  const granted: readonly string[] = AGENT_ROLE_PERMISSIONS[roleKey]
  return AGENT_SCOPED_PERMISSIONS.filter((permission) => granted.includes(permission)).sort()
}

describe("Desk agents - getAllOfProject", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
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
      route: DeskAgentsRoutes.getAllOfProject,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  it("returns the published agents sorted by name, with only the fields of the contract", async () => {
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
    await repositories.agentSettingsRepository.save([
      agentSettingsFactory.transient({ organization, project, agent: firstAgent }).build({
        revision: 1,
        greetingMessage: "Hello! How can I help you today?",
        isProduction: true,
      }),
      agentSettingsFactory
        .production()
        .transient({ organization, project, agent: secondAgent })
        .build(),
    ])
    await addUserToAgent({ repositories, agent: firstAgent, user })
    await addUserToAgent({ repositories, agent: secondAgent, user })

    const response = await subject()

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data).toStrictEqual([
      {
        id: firstAgent.id,
        name: "Helpful Assistant",
        type: "conversation",
        projectId: project.id,
        currentRevision: { greetingMessage: "Hello! How can I help you today?" },
        permissions: expect.any(Array),
      },
      {
        id: secondAgent.id,
        name: "Support",
        type: "extraction",
        projectId: project.id,
        currentRevision: {},
        permissions: expect.any(Array),
      },
    ])
  })

  it("gives the greeting of the revision in production, not the draft's", async () => {
    const { organization, project, user } = await createContext()
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Helpful Assistant" }),
    )
    await repositories.agentSettingsRepository.save([
      agentSettingsFactory.transient({ organization, project, agent }).build({
        revision: 1,
        greetingMessage: "Hello! How can I help you today?",
        isProduction: true,
      }),
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, greetingMessage: "A greeting still in draft", isDraft: true }),
    ])
    await addUserToAgent({ repositories, agent, user })

    const response = await subject()

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data[0]?.currentRevision.greetingMessage).toBe(
      "Hello! How can I help you today?",
    )
  })

  it("leaves out an agent that was never published, such as a fresh copy", async () => {
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

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data.map((agent) => agent.name)).toEqual(["Published Agent"])
  })

  it("gives the caller's permissions on each agent, and leaves out agents they only review", async () => {
    const { organization, project } = await createContext()
    const [ownedAgent, usedAgent, reviewedAgent] = await repositories.agentRepository.save([
      agentFactory.transient({ organization, project }).build({ name: "Owned Agent" }),
      agentFactory.transient({ organization, project }).build({ name: "Used Agent" }),
      agentFactory.transient({ organization, project }).build({ name: "Reviewed Agent" }),
    ])
    if (!ownedAgent || !usedAgent || !reviewedAgent) throw new Error("agents not saved")
    await repositories.agentSettingsRepository.save(
      [ownedAgent, usedAgent, reviewedAgent].map((agent) =>
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
      agent: ownedAgent,
      user: member,
      membership: { roleKeys: ["agent_owner"] },
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

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    const permissionsByName = Object.fromEntries(
      response.body.data.map((agent) => [agent.name, agent.permissions]),
    )
    expect(Object.keys(permissionsByName).sort()).toEqual(["Owned Agent", "Used Agent"])
    expect([...(permissionsByName["Owned Agent"] ?? [])].sort()).toEqual(
      exposedPermissionsOf("agent_owner"),
    )
    expect([...(permissionsByName["Used Agent"] ?? [])].sort()).toEqual(
      exposedPermissionsOf("agent_member"),
    )
  })

  it("gives the agents an evaluator reads, without the keys to open a live session", async () => {
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

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data.map((listedAgent) => listedAgent.name)).toEqual(["Evaluated Agent"])
    expect(response.body.data[0]?.permissions).toEqual([])
  })

  it("returns an empty list when the project has no agent", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskAgentsRoutes.getAllOfProject, response, 200)
    expect(response.body.data).toEqual([])
  })
})
