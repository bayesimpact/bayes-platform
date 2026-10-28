import { randomUUID } from "node:crypto"
import { AgentMembershipRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { addMemberByEmailToAgent } from "../agent-membership.factory"
import type { AgentRoleKey } from "../agent-membership.types"

describe("Agent Memberships - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let memberUserId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

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
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    memberUserId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** Creates an agent the caller belongs to, plus another member of that agent. */
  const createContextForRoles = async ({
    projectRole,
    agentRole,
  }: {
    projectRole: ProjectRoleKey
    agentRole: AgentRoleKey
  }) => {
    const { organization, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      organizationMembership: { roleKeys: ["org_member"] },
      projectMembership: { roleKeys: [projectRole] },
      agentMembership: { roleKeys: [agentRole] },
    })
    const { membership, addedUser } = await addMemberByEmailToAgent({ repositories, agent })
    // A member of the project too, as role changes on the agent require.
    await addUserToProject({
      repositories,
      project: { id: agent.projectId } as Project,
      user: addedUser,
      membership: { roleKeys: ["project_member"] },
    })
    organizationId = organization.id
    projectId = agent.projectId
    agentId = agent.id
    memberUserId = membership.userId
    return { organization }
  }

  /** Switches the caller to an organization admin who holds no role on the project or agent. */
  const switchToOrganizationAdminWithoutProjectRole = async (organization: Organization) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  const getAll = async () =>
    request({
      route: AgentMembershipRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
    })

  const deleteOne = async () =>
    request({
      route: AgentMembershipRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, userId: memberUserId }),
      token: accessToken ?? undefined,
    })

  const addRole = async () =>
    request({
      route: AgentMembershipRoutes.addRole,
      pathParams: removeNullish({ organizationId, projectId, agentId, userId: memberUserId }),
      token: accessToken ?? undefined,
      request: { payload: { roleKey: "agent_admin" } },
    })

  const removeRole = async () =>
    request({
      route: AgentMembershipRoutes.removeRole,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId,
        userId: memberUserId,
        roleKey: "agent_member",
      }),
      token: accessToken ?? undefined,
    })

  const addRoles = async () =>
    request({
      route: AgentMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
      request: { payload: { userIds: [memberUserId!], roleKeys: ["agent_admin"] } },
    })

  const deleteMany = async () =>
    request({
      route: AgentMembershipRoutes.deleteMany,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
      request: { payload: { userIds: [memberUserId!] } },
    })

  it("requires an authentication token", async () => {
    accessToken = null
    expectResponse(await getAll(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await deleteOne(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await addRole(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await removeRole(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await addRoles(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await deleteMany(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires the user to be a member of the organization", async () => {
    await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
    authSubject = mockForeignAuthSubject()
    expectResponse(await getAll(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    expectResponse(await deleteOne(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it.each<AgentRoleKey>([
    "agent_owner",
    "agent_admin",
  ])("lets an agent %s list and remove members, even as a project member", async (role) => {
    await createContextForRoles({ projectRole: "project_member", agentRole: role })
    expectResponse(await getAll(), 200)
    expectResponse(await addRole(), 201)
    expectResponse(await removeRole(), 200)
    expectResponse(await addRoles(), 201)
    expectResponse(await deleteOne(), 200)
  })

  it.each<AgentRoleKey>([
    "agent_owner",
    "agent_admin",
  ])("lets an agent %s remove members in bulk", async (role) => {
    await createContextForRoles({ projectRole: "project_member", agentRole: role })
    expectResponse(await deleteMany(), 200)
  })

  it("doesn't let an agent member list or remove members", async () => {
    await createContextForRoles({ projectRole: "project_member", agentRole: "agent_member" })
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await addRole(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await removeRole(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await addRoles(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteMany(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("doesn't let an agent member who owns the project list or remove members", async () => {
    await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_member" })
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("doesn't let an organization admin outside the project list or remove members", async () => {
    const { organization } = await createContextForRoles({
      projectRole: "project_owner",
      agentRole: "agent_owner",
    })
    await switchToOrganizationAdminWithoutProjectRole(organization)
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})
