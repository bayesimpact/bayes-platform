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
import { addUserToAgent } from "../agent-membership.factory"

describe("Agent Memberships - addRoles and deleteMany", () => {
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

  /** An agent owned by the caller, and two members of its project with no role on the agent. */
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
    const addProjectMember = async (email: string) =>
      (
        await addMemberByEmailToProject({
          repositories,
          organization,
          project,
          user: { email, authSubject: `oidc|${email}` },
          projectMembership: { roleKeys: ["project_member"] },
        })
      ).addedUser
    const first = await addProjectMember("first@example.com")
    const second = await addProjectMember("second@example.com")
    return { owner, agent, first, second }
  }

  const addRoles = (userIds: string[], roleKeys: string[]) =>
    request({
      route: AgentMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: "token",
      request: { payload: { userIds, roleKeys } },
    })

  const deleteMany = (userIds: string[]) =>
    request({
      route: AgentMembershipRoutes.deleteMany,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: "token",
      request: { payload: { userIds } },
    })

  const roleKeysOn = async (userId: string) => {
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "agent", resourceId: agentId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  it("gives roles on the agent to several members of the project", async () => {
    const { first, second } = await createContext()

    expectResponse(await addRoles([first.id, second.id], ["agent_member", "agent_admin"]), 201)

    expect(await roleKeysOn(first.id)).toEqual(["agent_admin", "agent_member"])
    expect(await roleKeysOn(second.id)).toEqual(["agent_admin", "agent_member"])
  })

  it("changes nobody when one of the users is not a member of the project", async () => {
    const { first } = await createContext()
    const {
      user: { id: outsiderId },
    } = await createOrganizationWithAgent(repositories)

    expectResponse(
      await addRoles([first.id, outsiderId], ["agent_member"]),
      404,
      "Some of the users are not members of the project",
    )
    expect(await roleKeysOn(first.id)).toEqual([])
  })

  it("refuses to change the caller's own roles", async () => {
    const { owner, first } = await createContext()

    expectResponse(
      await addRoles([first.id, owner.id], ["agent_member"]),
      403,
      "Cannot change your own role",
    )
  })

  it("refuses a role that is not an agent member role", async () => {
    const { first } = await createContext()

    expectResponse(
      await addRoles([first.id], ["agent_conversation_reviewer"]),
      400,
      "Not an agent member role: agent_conversation_reviewer",
    )
  })

  it("removes several members from the agent", async () => {
    const { first, second } = await createContext()
    expectResponse(await addRoles([first.id, second.id], ["agent_member"]), 201)

    expectResponse(await deleteMany([first.id, second.id]), 200)

    expect(await roleKeysOn(first.id)).toEqual([])
    expect(await roleKeysOn(second.id)).toEqual([])
  })

  it("refuses the owner role", async () => {
    const { first } = await createContext()

    expectResponse(
      await addRoles([first.id], ["agent_owner"]),
      403,
      "The owner role is not given or taken here",
    )
    expect(await roleKeysOn(first.id)).toEqual([])
  })

  it("removes nobody when one of them owns the agent", async () => {
    const { agent, first, second } = await createContext()
    await addUserToAgent({
      repositories,
      agent,
      user: first,
      membership: { roleKeys: ["agent_owner"] },
    })
    expectResponse(await addRoles([second.id], ["agent_member"]), 201)

    expectResponse(
      await deleteMany([first.id, second.id]),
      403,
      "Cannot remove owner from the agent",
    )
    expect(await roleKeysOn(second.id)).toEqual(["agent_member"])
  })

  it("removes nobody when one of the users is not a member of the agent", async () => {
    const { first, second } = await createContext()
    expectResponse(await addRoles([first.id], ["agent_member"]), 201)

    expectResponse(
      await deleteMany([first.id, second.id]),
      404,
      "Some of the users are not members of the agent",
    )
    expect(await roleKeysOn(first.id)).toEqual(["agent_member"])
  })

  it("refuses to remove the caller", async () => {
    const { owner, first } = await createContext()
    expectResponse(await addRoles([first.id], ["agent_member"]), 201)

    expectResponse(
      await deleteMany([first.id, owner.id]),
      403,
      "Cannot remove yourself from the agent",
    )
  })
})
