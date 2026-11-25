import { randomUUID } from "node:crypto"
import { EvalAgentsRoutes } from "@bayes-platform/eval-contracts"
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
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

type ProjectRouteName = "getAllOfProject" | "getModels"

const PROJECT_ROUTE_NAMES: ProjectRouteName[] = ["getAllOfProject", "getModels"]

describe("Evaluation agents - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let accessToken: string | undefined = "token"
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

  const createContextForRoles = async ({
    projectRole,
    agentRole = "agent_member",
  }: {
    projectRole: ProjectRoleKey
    agentRole?: AgentRoleKey
  }) => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      organizationMembership: { roleKeys: ["org_member"] },
      projectMembership: { roleKeys: [projectRole] },
      agentMembership: { roleKeys: [agentRole] },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    return { organization }
  }

  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRoles>>) => {
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

  const projectSubjects: Record<ProjectRouteName, () => ReturnType<SchemaRequester>> = {
    getAllOfProject: () =>
      request({
        route: EvalAgentsRoutes.getAllOfProject,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    getModels: () =>
      request({
        route: EvalAgentsRoutes.getModels,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
  }

  // `project.read` on the project, as `AgentsController.getAll` and `getAvailableModels` check.
  describe.each(PROJECT_ROUTE_NAMES)("EvalAgentsRoutes.%s", (routeName) => {
    const subject = () => projectSubjects[routeName]()

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
      "project_evaluator",
    ])("lets a project %s in", async (projectRole) => {
      await createContextForRoles({ projectRole })
      expectResponse(await subject(), 200)
    })

    it("doesn't let an organization admin outside the project in", async () => {
      const context = await createContextForRoles({
        projectRole: "project_owner",
        agentRole: "agent_owner",
      })
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  // `agent.settings.read` on the agent, as `AgentSettingsController.getAllWithDraft` checks.
  describe("EvalAgentsRoutes.getVersions", () => {
    const subject = () =>
      request({
        route: EvalAgentsRoutes.getVersions,
        pathParams: { organizationId, projectId, agentId },
        token: accessToken,
      })

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an agent id that is not a UUID", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      agentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("requires an existing project of the organization", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires an existing agent", async () => {
      await createContextForRoles({ projectRole: "project_owner" })
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRoles({ projectRole: "project_owner" })
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = otherProject.id
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
      "project_evaluator",
    ])("lets a project %s read the versions without an agent role", async (projectRole) => {
      await createContextForRoles({ projectRole })
      await repositories.roleGrantRepository.delete({ resourceType: "agent" })
      expectResponse(await subject(), 200)
    })

    it("doesn't let a project member who owns the agent read the versions", async () => {
      await createContextForRoles({ projectRole: "project_member", agentRole: "agent_owner" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an organization admin outside the project read the versions", async () => {
      const context = await createContextForRoles({
        projectRole: "project_owner",
        agentRole: "agent_owner",
      })
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
