import { createMCPClient } from "@ai-sdk/mcp"
import { McpServersRoutes } from "@bayes-platform/api-contracts"
import { afterAll } from "@jest/globals"
import { type INestApplication, Logger } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { McpServersModule } from "../mcp-servers.module"
import { type McpServerConfig, McpServersService } from "../mcp-servers.service"

jest.mock("@ai-sdk/mcp", () => ({
  createMCPClient: jest.fn(),
}))

// The outbound URL guard resolves the host before any call: example.com
// resolves to a public address, internal.example.com to a private one.
jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(async (hostname: string) =>
    hostname === "internal.example.com"
      ? [{ address: "10.0.0.12", family: 4 }]
      : [{ address: "93.184.216.34", family: 4 }],
  ),
}))

type McpClient = Awaited<ReturnType<typeof createMCPClient>>

describe("McpServers - inspect", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let mcpServersService: McpServersService
  const closeClient = jest.fn(async () => {})

  let organizationId: string
  let projectId: string
  let mcpServerId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpServersModule],
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
    closeClient.mockClear()
    jest.mocked(createMCPClient).mockReset()
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
  }

  const serverAnswersWithTools = (tools: { name: string; description?: string }[]) => {
    jest.mocked(createMCPClient).mockResolvedValue({
      listTools: async () => ({ tools }),
      close: closeClient,
    } as unknown as McpClient)
  }

  const lastClientOptions = () => jest.mocked(createMCPClient).mock.calls.at(-1)?.[0]

  const subject = async () =>
    request({
      route: McpServersRoutes.inspect,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId }),
      token: accessToken,
    })

  it("should report a connected server with its tools", async () => {
    await createContext({
      url: "https://mcp.example.com/mcp",
      authMethod: "apiKey",
      apiKey: "stored-key",
      headers: { "X-Api-Version": "2" },
    })
    serverAnswersWithTools([
      { name: "search_articles", description: "Searches the knowledge base." },
      { name: "get_article" },
    ])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      status: "connected",
      error: null,
      tools: [
        { name: "search_articles", description: "Searches the knowledge base." },
        { name: "get_article", description: null },
      ],
    })
    expect(response.body.data.checkedAt).toEqual(expect.any(Number))
    expect(lastClientOptions()?.transport).toMatchObject({
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer stored-key", "X-Api-Version": "2" },
    })
    expect(closeClient).toHaveBeenCalled()
  })

  it("should report why the connection failed", async () => {
    // The failure is logged by design; keep it out of the test output.
    const loggedWarning = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})
    await createContext({ url: "https://mcp.example.com/mcp", authMethod: "none" })
    jest
      .mocked(createMCPClient)
      .mockRejectedValue(
        new Error(
          'MCP HTTP Transport Error: POSTing to endpoint (HTTP 401): {"error":"invalid_token"}',
        ),
      )

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      status: "failed",
      tools: [],
      error: { code: "unauthorized", httpStatus: 401 },
    })
    loggedWarning.mockRestore()
  })

  it("should ask for an authorization when an OAuth server has no token", async () => {
    await createContext({ url: "https://mcp.example.com/mcp", authMethod: "oauth" })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      status: "authorizationRequired",
      tools: [],
      error: null,
    })
    expect(createMCPClient).not.toHaveBeenCalled()
  })

  it("should connect an authorized OAuth server with its access token", async () => {
    await createContext({
      url: "https://mcp.example.com/mcp",
      authMethod: "oauth",
      oauth: {
        clientId: "client-123",
        authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
        tokenEndpoint: "https://auth.example.com/oauth2/token",
        resource: "https://mcp.example.com",
        tokens: { accessToken: "at-1", expiresAt: Date.now() + 3_600_000 },
      },
    })
    serverAnswersWithTools([])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({ status: "connected", tools: [] })
    expect(lastClientOptions()?.transport).toMatchObject({
      headers: { Authorization: "Bearer at-1" },
    })
  })

  it.each([
    { url: "http://localhost:3100/mcp", authMethod: "none" as const },
    { url: "http://169.254.169.254/computeMetadata/v1/", authMethod: "none" as const },
    { url: "https://10.0.0.12/mcp", authMethod: "none" as const },
    { url: "https://internal.example.com/mcp", authMethod: "none" as const },
    { url: "https://internal.example.com/mcp", authMethod: "apiKey" as const, apiKey: "key" },
  ])("should not call $url for a server with the $authMethod method", async (config) => {
    await createContext(config)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      status: "failed",
      tools: [],
      error: { code: "urlNotAllowed", httpStatus: null },
    })
    expect(createMCPClient).not.toHaveBeenCalled()
  })

  it("should call a local server in development when the local flag is set", async () => {
    process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL = "true"
    try {
      await createContext({ url: "http://localhost:3100/mcp", authMethod: "none" })
      serverAnswersWithTools([{ name: "search_articles" }])

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data).toMatchObject({ status: "connected", error: null })
      expect(lastClientOptions()?.transport).toMatchObject({ url: "http://localhost:3100/mcp" })
    } finally {
      delete process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL
    }
  })

  it("should refuse the redirects of a server a project configured", async () => {
    await createContext({ url: "https://mcp.example.com/mcp", authMethod: "none" })
    serverAnswersWithTools([])

    await subject()

    expect(lastClientOptions()?.transport).toMatchObject({ redirect: "error" })
  })

  it("should refuse to send an OAuth token to a URL that resolves inside the network", async () => {
    await createContext({
      url: "https://internal.example.com/mcp",
      authMethod: "oauth",
      oauth: {
        clientId: "client-123",
        authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
        tokenEndpoint: "https://auth.example.com/oauth2/token",
        resource: "https://internal.example.com",
        tokens: { accessToken: "at-1", expiresAt: Date.now() + 3_600_000 },
      },
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      status: "failed",
      error: { code: "urlNotAllowed", httpStatus: null },
    })
    expect(createMCPClient).not.toHaveBeenCalled()
  })
})
