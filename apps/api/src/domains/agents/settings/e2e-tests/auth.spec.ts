import { randomUUID } from "node:crypto"
import { AgentSettingsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

describe("Agent Settings - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
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
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      organizationMembership: { role: "member" },
      projectMembership: { role },
      // The settings endpoints check the agent membership, so it carries the tested role too.
      agentMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    accessToken = "token"
    return { organization, project }
  }

  describe("AgentSettingsRoutes.getAllWithDraft", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.getAllWithDraft,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to read the revision history", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows an owner to read the revision history", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
  })

  describe("AgentSettingsRoutes.updateOne", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { instructions: "New instructions" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to update the settings", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentSettingsRoutes.getFillFormOutputJsonSchema", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.getFillFormOutputJsonSchema,
        pathParams: removeNullish({ organizationId, projectId, agentId, revision: "1" }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("allows a simple member of the agent to read the form schema, as the session side needs it", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })
    it("allows an owner to read the form schema of a revision", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
  })

  describe("AgentSettingsRoutes.restoreOne", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.restoreOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, revision: "1" }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      // Use a valid UUID format that doesn't exist in the database
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to restore a revision", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentSettingsRoutes.createOne", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, revision: "1" }),
        token: accessToken ?? undefined,
        request: { payload: { revisionName: "A name", revisionDesc: "A description" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to publish a new revision", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentSettingsRoutes.archiveOne", () => {
    const subject = async () =>
      request({
        route: AgentSettingsRoutes.archiveOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, revision: "1" }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to archive a revision", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("role matrix", () => {
    type Role = "owner" | "admin" | "member"

    const createContextForRoles = async ({
      projectRole,
      agentRole,
    }: {
      projectRole: Role
      agentRole: Role
    }) => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
        organizationMembership: { role: "member" },
        projectMembership: { role: projectRole },
        agentMembership: { role: agentRole },
      })
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      return { organization }
    }

    const switchToOrganizationAdminWithoutProjectMembership = async (
      organization: Awaited<ReturnType<typeof createContextForRoles>>["organization"],
    ) => {
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

    const removeAgentMemberships = async () => {
      await repositories.userMembershipRepository.delete({ resourceType: "agent" })
    }

    const pathParams = () => removeNullish({ organizationId, projectId, agentId })
    const revisionPathParams = () =>
      removeNullish({ organizationId, projectId, agentId, revision: "1" })

    const getAll = async () =>
      request({
        route: AgentSettingsRoutes.getAllWithDraft,
        pathParams: pathParams(),
        token: "token",
      })

    const getFillFormOutputJsonSchema = async () =>
      request({
        route: AgentSettingsRoutes.getFillFormOutputJsonSchema,
        pathParams: revisionPathParams(),
        token: "token",
      })

    const updateOne = async () =>
      request({
        route: AgentSettingsRoutes.updateOne,
        pathParams: pathParams(),
        token: "token",
        request: { payload: { instructions: "New instructions" } },
      })

    const restoreOne = async () =>
      request({
        route: AgentSettingsRoutes.restoreOne,
        pathParams: revisionPathParams(),
        token: "token",
      })

    const createOne = async () =>
      request({
        route: AgentSettingsRoutes.createOne,
        pathParams: revisionPathParams(),
        token: "token",
        request: { payload: { revisionName: "A name", revisionDesc: "A description" } },
      })

    const archiveOne = async () =>
      request({
        route: AgentSettingsRoutes.archiveOne,
        pathParams: revisionPathParams(),
        token: "token",
      })

    // The business outcome of a mutation depends on the seeded revisions, so an allowed
    // call only has to get past the permission check.
    const expectAllowed = (response: { status: number }) => {
      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    }

    const expectForbidden = (response: Parameters<typeof expectResponse>[0]) => {
      expectResponse(response, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    it.each<Role>([
      "owner",
      "admin",
    ])("lets a project %s read the history without an agent role", async (role) => {
      await createContextForRoles({ projectRole: role, agentRole: "member" })
      await removeAgentMemberships()
      expectResponse(await getAll(), 200)
    })

    it("doesn't let a project member who owns the agent read the history", async () => {
      await createContextForRoles({ projectRole: "member", agentRole: "owner" })
      expectForbidden(await getAll())
    })

    it.each<Role>([
      "owner",
      "admin",
      "member",
    ])("lets an agent %s read the form schema, even as a project member", async (role) => {
      await createContextForRoles({ projectRole: "member", agentRole: role })
      expectResponse(await getFillFormOutputJsonSchema(), 200)
    })

    it.each<Role>([
      "owner",
      "admin",
    ])("lets a project %s read the form schema without an agent role", async (role) => {
      await createContextForRoles({ projectRole: role, agentRole: "member" })
      await removeAgentMemberships()
      expectResponse(await getFillFormOutputJsonSchema(), 200)
    })

    it("doesn't let a project member without an agent role read the form schema", async () => {
      await createContextForRoles({ projectRole: "member", agentRole: "member" })
      await removeAgentMemberships()
      expectForbidden(await getFillFormOutputJsonSchema())
    })

    it.each<Role>([
      "owner",
      "admin",
    ])("lets an agent %s change the settings, even as a project member", async (role) => {
      await createContextForRoles({ projectRole: "member", agentRole: role })
      expectAllowed(await updateOne())
      expectAllowed(await restoreOne())
      expectAllowed(await createOne())
      expectAllowed(await archiveOne())
    })

    it("doesn't let an agent member who owns the project change the settings", async () => {
      await createContextForRoles({ projectRole: "owner", agentRole: "member" })
      expectForbidden(await updateOne())
      expectForbidden(await restoreOne())
      expectForbidden(await createOne())
      expectForbidden(await archiveOne())
    })

    it("doesn't let an organization admin outside the project read or change the settings", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "owner",
        agentRole: "owner",
      })
      await switchToOrganizationAdminWithoutProjectMembership(organization)
      expectForbidden(await getAll())
      expectForbidden(await getFillFormOutputJsonSchema())
      expectForbidden(await updateOne())
      expectForbidden(await restoreOne())
      expectForbidden(await createOne())
      expectForbidden(await archiveOne())
    })
  })
})
