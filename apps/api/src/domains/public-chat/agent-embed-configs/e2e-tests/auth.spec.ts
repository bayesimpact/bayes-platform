import { randomUUID } from "node:crypto"
import { AgentEmbedConfigsRoutes } from "@caseai-connect/api-contracts"
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
import type { AgentRoleKey } from "@/domains/agents/memberships/agent-membership.types"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentEmbedConfigFactory } from "../agent-embed-config.factory"
import { AgentEmbedConfigsManagementModule } from "../agent-embed-configs-management.module"

describe("AgentEmbedConfigs Management - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentEmbedConfigsManagementModule],
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

  const createContextForRoles = async ({
    projectRole,
    agentRole,
  }: {
    projectRole: ProjectRoleKey
    agentRole: AgentRoleKey
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
    accessToken = "token"
    return { organization, project, agent }
  }

  describe("AgentEmbedConfigsRoutes.getOne", () => {
    const subject = async () =>
      request({
        route: AgentEmbedConfigsRoutes.getOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid project ID", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "project_owner",
        agentRole: "agent_owner",
      })
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })

    it.each<AgentRoleKey>([
      "agent_owner",
      "agent_admin",
    ])("lets an agent %s get the embed config, even as a project member", async (role) => {
      await createContextForRoles({ projectRole: "project_member", agentRole: role })
      expectResponse(await subject(), 200)
    })

    it("doesn't let an agent member get the embed config", async () => {
      await createContextForRoles({ projectRole: "project_member", agentRole: "agent_member" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an agent member who owns the project get the embed config", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_member" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("AgentEmbedConfigsRoutes.updateOne", () => {
    const subject = async () =>
      request({
        route: AgentEmbedConfigsRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { isEnabled: true } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid project ID", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_owner" })
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("requires the agent to be part of the project", async () => {
      const { organization } = await createContextForRoles({
        projectRole: "project_owner",
        agentRole: "agent_owner",
      })
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })

    it.each<AgentRoleKey>([
      "agent_owner",
      "agent_admin",
    ])("lets an agent %s update the embed config, even as a project member", async (role) => {
      const { organization, project, agent } = await createContextForRoles({
        projectRole: "project_member",
        agentRole: role,
      })
      await repositories.agentEmbedConfigRepository.save(
        agentEmbedConfigFactory.transient({ organization, project, agent }).build(),
      )
      expectResponse(await subject(), 200)
    })

    it("doesn't let an agent member update the embed config", async () => {
      await createContextForRoles({ projectRole: "project_member", agentRole: "agent_member" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an agent member who owns the project update the embed config", async () => {
      await createContextForRoles({ projectRole: "project_owner", agentRole: "agent_member" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
