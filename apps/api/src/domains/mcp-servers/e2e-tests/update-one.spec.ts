import { McpServersRoutes, type UpdateMcpServerDto } from "@bayes-platform/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { AgentsModule } from "@/domains/agents/agents.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { PDF_EXPORT_BUILT_IN_NAME, PDF_EXPORT_PRESET_SLUG } from "../built-in/built-in-mcp-servers"
import { BuiltInMcpServersService } from "../built-in/built-in-mcp-servers.service"
import { McpServersModule } from "../mcp-servers.module"
import { type McpServerConfig, McpServersService } from "../mcp-servers.service"

const OAUTH_STATE = {
  clientId: "client-123",
  authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
  tokenEndpoint: "https://auth.example.com/oauth2/token",
  resource: "https://mcp.example.com",
  tokens: { accessToken: "at-1", refreshToken: "rt-1" },
  authorizedAt: 1_700_000_000_000,
}

// The agent reads its servers through the outbound URL guard, which resolves
// the host: every example name resolves to a public address.
jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}))
describe("McpServers - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let mcpServersService: McpServersService

  let organizationId: string
  let projectId: string
  let mcpServerId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpServersModule, AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    mcpServersService = setup.module.get(McpServersService)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (config: McpServerConfig) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    const mcpServer = await mcpServersService.createMcpServer({
      projectId: project.id,
      name: "Knowledge Base",
      config,
    })
    mcpServerId = mcpServer.id
    return { organization, project, mcpServer }
  }

  const subject = async (payload: UpdateMcpServerDto) =>
    request({
      route: McpServersRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId }),
      token: accessToken,
      request: { payload },
    })

  const storedConfig = async () => {
    const stored = await repositories.mcpServerRepository.findOneOrFail({
      where: { id: mcpServerId },
    })
    return mcpServersService.getConfig(stored)
  }

  it("should rename the server and change its URL", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "none" })

    const response = await subject({ name: "Renamed", url: "https://other.example.com/mcp" })

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      id: mcpServerId,
      name: "Renamed",
      url: "https://other.example.com/mcp",
      authMethod: "none",
      authStatus: "none",
    })
    expect((await storedConfig()).url).toBe("https://other.example.com/mcp")
  })

  it("should keep the stored key when none is sent", async () => {
    await createContext({
      url: "https://mcp.example.com",
      authMethod: "apiKey",
      apiKey: "stored-key",
    })

    const response = await subject({ name: "Renamed", apiKey: "" })

    expectResponse(response, 200)
    expect(response.body.data.authStatus).toBe("apiKey")
    expect((await storedConfig()).apiKey).toBe("stored-key")
    expect(JSON.stringify(response.body)).not.toContain("stored-key")
  })

  it("should replace the key when a new one is sent", async () => {
    await createContext({
      url: "https://mcp.example.com",
      authMethod: "apiKey",
      apiKey: "stored-key",
    })

    expectResponse(await subject({ apiKey: "new-key" }), 200)

    expect((await storedConfig()).apiKey).toBe("new-key")
  })

  it("should reject a switch to the apiKey method without a key", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "none" })

    expectResponse(await subject({ authMethod: "apiKey" }), 400)

    expect((await storedConfig()).authMethod).toBe("none")
  })

  it("should drop the key when the method leaves apiKey", async () => {
    await createContext({
      url: "https://mcp.example.com",
      authMethod: "apiKey",
      apiKey: "stored-key",
    })

    const response = await subject({ authMethod: "none" })

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({ authMethod: "none", authStatus: "none" })
    expect((await storedConfig()).apiKey).toBeUndefined()
  })

  it("should keep the OAuth authorization when only the name changes", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "oauth", oauth: OAUTH_STATE })

    const response = await subject({ name: "Renamed" })

    expectResponse(response, 200)
    expect(response.body.data.authStatus).toBe("oauthConnected")
    expect((await storedConfig()).oauth).toEqual(OAUTH_STATE)
  })

  it("should drop the OAuth authorization when the URL changes", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "oauth", oauth: OAUTH_STATE })

    const response = await subject({ url: "https://other.example.com/mcp" })

    expectResponse(response, 200)
    expect(response.body.data.authStatus).toBe("oauthPending")
    expect((await storedConfig()).oauth).toBeUndefined()
  })

  it("should keep, replace, add and remove headers, and never return their values", async () => {
    await createContext({
      url: "https://mcp.example.com",
      authMethod: "none",
      headers: { "X-Tenant": "tenant-secret", "X-Api-Version": "1", "X-Removed": "gone" },
    })

    const response = await subject({
      headers: { "X-Tenant": null, "X-Api-Version": "2", "X-Added": "new" },
    })

    expectResponse(response, 200)
    expect(response.body.data.headerNames).toEqual(["X-Added", "X-Api-Version", "X-Tenant"])
    expect(JSON.stringify(response.body)).not.toContain("tenant-secret")
    expect((await storedConfig()).headers).toEqual({
      "X-Tenant": "tenant-secret",
      "X-Api-Version": "2",
      "X-Added": "new",
    })
  })

  it("should reject a header to keep that has no stored value", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "none" })

    expectResponse(await subject({ headers: { "X-Unknown": null } }), 400)
  })

  it("should leave the headers alone when the field is absent", async () => {
    await createContext({
      url: "https://mcp.example.com",
      authMethod: "none",
      headers: { "X-Api-Version": "1" },
    })

    expectResponse(await subject({ name: "Renamed" }), 200)

    expect((await storedConfig()).headers).toEqual({ "X-Api-Version": "1" })
  })

  it("should keep the server enabled on its agents", async () => {
    const { organization, project } = await createContext({
      url: "https://mcp.example.com",
      authMethod: "none",
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    await mcpServersService.enableForAgent(agent.id, mcpServerId)

    expectResponse(await subject({ url: "https://other.example.com/mcp" }), 200)

    const enabledServers = await mcpServersService.getEnabledServersForAgent(agent.id)
    expect(enabledServers).toEqual([
      expect.objectContaining({ id: mcpServerId, url: "https://other.example.com/mcp" }),
    ])
  })

  it("should reject an invalid URL and an empty name", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "none" })

    expectResponse(await subject({ url: "not-a-url" }), 400)
    expectResponse(await subject({ name: " " }), 400)
  })

  it("should refuse to edit a built-in server", async () => {
    await createContext({ url: "https://mcp.example.com", authMethod: "none" })
    const initialConverterUrl = process.env.PDF_CONVERTER_URL
    process.env.PDF_CONVERTER_URL = "https://pdf-converter.example.test"
    try {
      await setup.module.get(BuiltInMcpServersService).syncFromEnvironment()
    } finally {
      if (initialConverterUrl === undefined) delete process.env.PDF_CONVERTER_URL
      else process.env.PDF_CONVERTER_URL = initialConverterUrl
    }
    const builtIn = await repositories.mcpServerRepository.findOneOrFail({
      where: { presetSlug: PDF_EXPORT_PRESET_SLUG },
    })
    mcpServerId = builtIn.id

    expectResponse(await subject({ name: "Hijacked" }), 403)

    const stored = await repositories.mcpServerRepository.findOneOrFail({
      where: { id: builtIn.id },
    })
    expect(stored.name).toBe(PDF_EXPORT_BUILT_IN_NAME)
  })
})
