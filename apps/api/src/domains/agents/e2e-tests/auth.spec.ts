import { randomUUID } from "node:crypto"
import {
  AgentLocale,
  AgentModel,
  AgentSubAgentsRoutes,
  AgentsRoutes,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
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
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { Agent } from "../agent.entity"
import { AgentsModule } from "../agents.module"

describe("Agents - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let _agentRepository: Repository<Agent>

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
    _agentRepository = setup.getRepository(Agent)
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
      agentMembership: { role: "member" },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    accessToken = "token"
    return { organization, project }
  }

  describe("AgentsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: AgentsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
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
      projectId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("allows a simple member to get all agents", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })
  })

  describe("AgentsRoutes.getAllWithDrafts", () => {
    const subject = async () =>
      request({
        route: AgentsRoutes.getAllWithDrafts,
        pathParams: removeNullish({ organizationId, projectId }),
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
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("allows a project admin to get all agents with drafts", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
    it("doesn't allow a simple member to get all agents with drafts", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentsRoutes.createOne", () => {
    const subject = async (payload?: typeof AgentsRoutes.createOne.request) =>
      request({
        route: AgentsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: payload,
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
      projectId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to upload a agent", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: AgentsRoutes.deleteOne,
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
      // Use a valid UUID format that doesn't exist in the database
      projectId = randomUUID()
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
    it("doesn't allow a simple member to delete a agent", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentsRoutes.updateOne", () => {
    const subject = async () =>
      request({
        route: AgentsRoutes.updateOne,
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
      // Use a valid UUID format that doesn't exist in the database
      projectId = randomUUID()
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
    it("doesn't allow a simple member to delete a agent", async () => {
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

    const pathParams = () => removeNullish({ organizationId, projectId, agentId })

    const getAll = async () =>
      request({ route: AgentsRoutes.getAll, pathParams: pathParams(), token: "token" })

    const getAllWithDrafts = async () =>
      request({ route: AgentsRoutes.getAllWithDrafts, pathParams: pathParams(), token: "token" })

    const createOne = async () =>
      request({
        route: AgentsRoutes.createOne,
        pathParams: pathParams(),
        token: "token",
        request: {
          payload: {
            type: "conversation",
            name: "New Agent",
            instructions: "This is a default prompt",
            documentsRagMode: DocumentsRagMode.All,
            model: AgentModel.Gemini25Flash,
            temperature: 0,
            locale: AgentLocale.EN,
            tagsToAdd: [],
            projectAgentSessionCategoryIds: [],
          },
        },
      })

    const updateOne = async () =>
      request({
        route: AgentsRoutes.updateOne,
        pathParams: pathParams(),
        token: "token",
        request: { payload: { name: "Renamed Agent" } },
      })

    const deleteOne = async () =>
      request({ route: AgentsRoutes.deleteOne, pathParams: pathParams(), token: "token" })

    const getAllSubAgents = async () =>
      request({ route: AgentSubAgentsRoutes.getAll, pathParams: pathParams(), token: "token" })

    const updateAllSubAgents = async () =>
      request({
        route: AgentSubAgentsRoutes.updateAll,
        pathParams: pathParams(),
        token: "token",
        request: { payload: { subAgents: [] } },
      })

    it.each<Role>(["owner", "admin", "member"])("lets a project %s list agents", async (role) => {
      await createContextForRoles({ projectRole: role, agentRole: "member" })
      expectResponse(await getAll(), 200)
    })

    it.each<Role>(["owner", "admin"])("lets a project %s list agents with drafts", async (role) => {
      await createContextForRoles({ projectRole: role, agentRole: "member" })
      expectResponse(await getAllWithDrafts(), 200)
    })

    it("doesn't let a project member who owns an agent list agents with drafts", async () => {
      await createContextForRoles({ projectRole: "member", agentRole: "owner" })
      expectResponse(await getAllWithDrafts(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an organization admin outside the project list agents", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "owner",
        agentRole: "owner",
      })
      await switchToOrganizationAdminWithoutProjectMembership(organization)
      expectResponse(await getAll(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await getAllWithDrafts(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<Role>(["owner", "admin"])("lets a project %s create an agent", async (role) => {
      await createContextForRoles({ projectRole: role, agentRole: "member" })
      expectResponse(await createOne(), 201)
    })

    it("doesn't let a project member who owns an agent create one", async () => {
      await createContextForRoles({ projectRole: "member", agentRole: "owner" })
      expectResponse(await createOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<Role>([
      "owner",
      "admin",
    ])("lets an agent %s update the agent and its sub-agents, even as a project member", async (role) => {
      await createContextForRoles({ projectRole: "member", agentRole: role })
      expectResponse(await updateOne(), 200)
      expectResponse(await getAllSubAgents(), 200)
      expectResponse(await updateAllSubAgents(), 200)
    })

    it("doesn't let an agent member who owns the project update the agent or read its sub-agents", async () => {
      await createContextForRoles({ projectRole: "owner", agentRole: "member" })
      expectResponse(await updateOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await getAllSubAgents(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await updateAllSubAgents(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<Role>([
      "owner",
      "admin",
    ])("lets an agent %s delete the agent, even as a project member", async (role) => {
      await createContextForRoles({ projectRole: "member", agentRole: role })
      expectResponse(await deleteOne(), 200)
    })

    it("doesn't let an organization admin outside the project touch an agent", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "owner",
        agentRole: "owner",
      })
      await switchToOrganizationAdminWithoutProjectMembership(organization)
      expectResponse(await createOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await updateOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await getAllSubAgents(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await deleteOne(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
