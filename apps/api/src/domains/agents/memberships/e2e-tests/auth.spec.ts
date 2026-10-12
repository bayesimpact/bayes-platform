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
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { addMemberByEmailToAgent } from "../agent-membership.factory"

type Role = "owner" | "admin" | "member"

describe("Agent Memberships - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentMembershipId: string | null = randomUUID()
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
    agentMembershipId = randomUUID()
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
    projectRole: Role
    agentRole: Role
  }) => {
    const { organization, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      organizationMembership: { role: "member" },
      projectMembership: { role: projectRole },
      agentMembership: { role: agentRole },
    })
    const { membership } = await addMemberByEmailToAgent({ repositories, agent })
    organizationId = organization.id
    projectId = agent.projectId
    agentId = agent.id
    agentMembershipId = membership.id
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
      membership: { role: "admin" },
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
      pathParams: removeNullish({ organizationId, projectId, agentId, agentMembershipId }),
      token: accessToken ?? undefined,
    })

  it("requires an authentication token", async () => {
    accessToken = null
    expectResponse(await getAll(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await deleteOne(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires the user to be a member of the organization", async () => {
    await createContextForRoles({ projectRole: "owner", agentRole: "owner" })
    authSubject = mockForeignAuthSubject()
    expectResponse(await getAll(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    expectResponse(await deleteOne(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it.each<Role>([
    "owner",
    "admin",
  ])("lets an agent %s list and remove members, even as a project member", async (role) => {
    await createContextForRoles({ projectRole: "member", agentRole: role })
    expectResponse(await getAll(), 200)
    expectResponse(await deleteOne(), 200)
  })

  it("doesn't let an agent member list or remove members", async () => {
    await createContextForRoles({ projectRole: "member", agentRole: "member" })
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("doesn't let an agent member who owns the project list or remove members", async () => {
    await createContextForRoles({ projectRole: "owner", agentRole: "member" })
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("doesn't let an organization admin outside the project list or remove members", async () => {
    const { organization } = await createContextForRoles({
      projectRole: "owner",
      agentRole: "owner",
    })
    await switchToOrganizationAdminWithoutProjectRole(organization)
    expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})
