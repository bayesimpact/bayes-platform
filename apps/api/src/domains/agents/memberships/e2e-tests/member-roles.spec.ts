import { randomUUID } from "node:crypto"
import { AgentMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { grantConversationReview } from "../../conversation-reviewers/agent-conversation-reviewer.factory"

describe("Agent Memberships - addRole and removeRole", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** An agent owned by the caller, and a member of its project with no role on the agent. */
  const createContext = async () => {
    const {
      user: owner,
      organization,
      project,
      agent,
    } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = owner.authSubject!
    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: "oidc|member" },
      projectMembership: { roleKeys: ["project_member"] },
    })
    return { owner, agent, member }
  }

  const addRole = (userId: string, roleKey: string) =>
    request({
      route: AgentMembershipRoutes.addRole,
      pathParams: removeNullish({ organizationId, projectId, agentId, userId }),
      token: "token",
      request: { payload: { roleKey } },
    })

  const removeRole = (userId: string, roleKey: string) =>
    request({
      route: AgentMembershipRoutes.removeRole,
      pathParams: removeNullish({ organizationId, projectId, agentId, userId, roleKey }),
      token: "token",
    })

  const roleKeysOn = async (userId: string) => {
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "agent", resourceId: agentId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  it("gives a member of the project roles on the agent, and takes them away", async () => {
    const { member } = await createContext()

    expectResponse(await addRole(member.id, "agent_member"), 201)
    expectResponse(await addRole(member.id, "agent_admin"), 201)
    expect(await roleKeysOn(member.id)).toEqual(["agent_admin", "agent_member"])

    expectResponse(await removeRole(member.id, "agent_member"), 200)
    expect(await roleKeysOn(member.id)).toEqual(["agent_admin"])
  })

  it("refuses the conversation reviewer role, a backoffice grant", async () => {
    const { member } = await createContext()
    await grantConversationReview({
      repositories,
      user: member,
      agent: { id: agentId } as Parameters<typeof grantConversationReview>[0]["agent"],
    })

    expectResponse(
      await addRole(member.id, "agent_conversation_reviewer"),
      400,
      "Not an agent member role: agent_conversation_reviewer",
    )
    expectResponse(await removeRole(member.id, "agent_conversation_reviewer"), 400)
    expect(await roleKeysOn(member.id)).toEqual(["agent_conversation_reviewer"])
  })

  it("refuses someone outside the project", async () => {
    await createContext()

    expectResponse(await addRole(randomUUID(), "agent_member"), 404)
  })

  it("refuses to change the caller's own roles", async () => {
    const { owner } = await createContext()

    expectResponse(await addRole(owner.id, "agent_admin"), 403, "Cannot change your own role")
  })

  it("neither gives nor takes the owner role", async () => {
    const { owner, member } = await createContext()

    expectResponse(
      await addRole(member.id, "agent_owner"),
      403,
      "The owner role is not given or taken here",
    )
    await addRole(member.id, "agent_admin")
    authSubject = member.authSubject!
    expectResponse(
      await removeRole(owner.id, "agent_owner"),
      403,
      "The owner role is not given or taken here",
    )
  })
})
