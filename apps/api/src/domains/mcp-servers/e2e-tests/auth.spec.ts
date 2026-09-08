import { randomUUID } from "node:crypto"
import { McpServersRoutes } from "@caseai-connect/api-contracts"
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
import { agentFactory } from "@/domains/agents/agent.factory"
import { AgentsModule } from "@/domains/agents/agents.module"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { mcpServerFactory } from "../mcp-server.factory"
import { McpServersModule } from "../mcp-servers.module"

type ProjectRole = "owner" | "admin" | "member"

describe("McpServers - auth and scoping", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let mcpServerId: string
  let agentId: string
  let accessToken: string | null = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpServersModule, AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
    mcpServerId = randomUUID()
    agentId = randomUUID()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectRole = "owner") => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      organizationMembership: { role: "member" },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id

    const mcpServer = mcpServerFactory.build({ name: "Scoped Server", projectId: project.id })
    await repositories.mcpServerRepository.save(mcpServer)
    mcpServerId = mcpServer.id

    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    agentId = agent.id

    return { organization, project, mcpServer, agent }
  }

  const createServerInOtherProject = async (organization: Organization) => {
    const otherProject = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(otherProject)
    const foreignServer = mcpServerFactory.build({
      name: "Foreign Server",
      projectId: otherProject.id,
    })
    await repositories.mcpServerRepository.save(foreignServer)
    return { otherProject, foreignServer }
  }

  const pathParams = () => removeNullish({ organizationId, projectId, mcpServerId, agentId })

  describe("createOne", () => {
    const subject = () =>
      request({
        route: McpServersRoutes.createOne,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
        request: { payload: { name: "New Server", url: "https://new.example.com" } },
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it.each<ProjectRole>(["owner", "admin"])("allows a project %s to create", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })

    it("forbids a simple project member from creating", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("getAll", () => {
    const subject = () =>
      request({
        route: McpServersRoutes.getAll,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("allows a simple project member to list", async () => {
      const { mcpServer } = await createContextForRole("member")
      // Factory config is not decryptable, replace with one created through the API as owner.
      await repositories.mcpServerRepository.delete({ id: mcpServer.id })

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data).toEqual([])
    })

    it("returns the decrypted URL and never the API key", async () => {
      const { mcpServer } = await createContextForRole("owner")
      await repositories.mcpServerRepository.delete({ id: mcpServer.id })
      await request({
        route: McpServersRoutes.createOne,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
        request: {
          payload: { name: "Secured", url: "https://secured.example.com", apiKey: "sk-top-secret" },
        },
      })

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        name: "Secured",
        url: "https://secured.example.com",
        projectId,
      })
      expect(JSON.stringify(response.body)).not.toContain("sk-top-secret")
    })

    it("does not list servers from another project of the same organization", async () => {
      const { organization, mcpServer } = await createContextForRole("owner")
      await repositories.mcpServerRepository.delete({ id: mcpServer.id })
      await createServerInOtherProject(organization)
      await request({
        route: McpServersRoutes.createOne,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
        request: { payload: { name: "Mine", url: "https://mine.example.com" } },
      })

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data.map((server: { name: string }) => server.name)).toEqual(["Mine"])
    })
  })

  describe("deleteOne", () => {
    const subject = () =>
      request({
        route: McpServersRoutes.deleteOne,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it.each<ProjectRole>(["owner", "admin"])("allows a project %s to delete", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })

    it("forbids a simple project member from deleting", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

      expect(
        await repositories.mcpServerRepository.findOne({ where: { id: mcpServerId } }),
      ).not.toBeNull()
    })

    it("returns 404 for an unknown server", async () => {
      await createContextForRole("owner")
      mcpServerId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("returns 404 for a server of another project in the same organization", async () => {
      const { organization } = await createContextForRole("owner")
      const { foreignServer } = await createServerInOtherProject(organization)
      mcpServerId = foreignServer.id

      expectResponse(await subject(), 404)

      expect(
        await repositories.mcpServerRepository.findOne({ where: { id: foreignServer.id } }),
      ).not.toBeNull()
    })

    it("returns 404 for a preset server", async () => {
      await createContextForRole("owner")
      const preset = mcpServerFactory.preset("auth-preset").build()
      await repositories.mcpServerRepository.save(preset)
      mcpServerId = preset.id

      expectResponse(await subject(), 404)
    })

    it("also removes the agent links of the deleted server", async () => {
      await createContextForRole("owner")
      await repositories.agentMcpServerRepository.save(
        repositories.agentMcpServerRepository.create({ agentId, mcpServerId, enabled: true }),
      )

      expectResponse(await subject(), 200)

      expect(
        await repositories.agentMcpServerRepository.findOne({ where: { agentId, mcpServerId } }),
      ).toBeNull()
    })
  })

  describe("enableForAgent", () => {
    const subject = () =>
      request({
        route: McpServersRoutes.enableForAgent,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it.each<ProjectRole>(["owner", "admin"])("allows a project %s to enable", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })

    it("forbids a simple project member from enabling", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

      expect(
        await repositories.agentMcpServerRepository.findOne({ where: { agentId, mcpServerId } }),
      ).toBeNull()
    })

    it("returns 404 for a server of another project", async () => {
      const { organization } = await createContextForRole("owner")
      const { foreignServer } = await createServerInOtherProject(organization)
      mcpServerId = foreignServer.id

      expectResponse(await subject(), 404)
    })
  })

  describe("disableForAgent", () => {
    const subject = () =>
      request({
        route: McpServersRoutes.disableForAgent,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("forbids a simple project member from disabling", async () => {
      await createContextForRole("member")
      await repositories.agentMcpServerRepository.save(
        repositories.agentMcpServerRepository.create({ agentId, mcpServerId, enabled: true }),
      )

      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

      expect(
        await repositories.agentMcpServerRepository.findOne({ where: { agentId, mcpServerId } }),
      ).not.toBeNull()
    })

    it("returns 404 for a server of another project", async () => {
      const { organization } = await createContextForRole("owner")
      const { foreignServer } = await createServerInOtherProject(organization)
      mcpServerId = foreignServer.id

      expectResponse(await subject(), 404)
    })

    it("succeeds even when no link exists", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
  })
})
