import { randomUUID } from "node:crypto"
import { DeskAgentsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { AgentRoleKey } from "@/domains/agents/memberships/agent-membership.types"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk agents - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let accessToken: string | undefined = "token"
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
    organizationId = randomUUID()
    projectId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRoles = async ({
    projectRole,
    agentRole = "agent_member",
  }: {
    projectRole: ProjectRoleKey
    agentRole?: AgentRoleKey
  }) => {
    const { organization, project } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      organizationMembership: { roleKeys: ["org_member"] },
      projectMembership: { roleKeys: [projectRole] },
      agentMembership: { roleKeys: [agentRole] },
    })
    organizationId = organization.id
    projectId = project.id
    return { organization }
  }

  const subject = async () =>
    request({
      route: DeskAgentsRoutes.getAllOfProject,
      pathParams: { organizationId, projectId },
      token: accessToken,
    })

  describe("DeskAgentsRoutes.getAllOfProject", () => {
    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an organization id that is not a UUID", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      organizationId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 400 for a project id that is not a UUID", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      projectId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("requires an existing project of the organization", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("lets a project %s list agents", async (projectRole) => {
      await createContextForRoles({ projectRole })
      expectResponse(await subject(), 200)
    })

    it("doesn't let an organization admin outside the project list agents", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "project_owner",
        agentRole: "agent_owner",
      })
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

      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
