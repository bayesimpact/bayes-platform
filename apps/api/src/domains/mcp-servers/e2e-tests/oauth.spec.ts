process.env.MCP_OAUTH_REDIRECT_URL = "https://app.test/oauth/mcp/callback"

import { randomUUID } from "node:crypto"
import { McpServersRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { McpServersModule } from "../mcp-servers.module"

global.fetch = jest.fn()
const fetchMock = global.fetch as jest.Mock

const MCP_URL = "https://mcp.example.com/mcp"

const resourceMetadata = {
  resource: "https://mcp.example.com",
  authorization_servers: ["https://auth.example.com"],
  scopes_supported: ["mcp.tools", "offline_access"],
}

const authServerMetadata = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/oauth2/authorize",
  token_endpoint: "https://auth.example.com/oauth2/token",
  registration_endpoint: "https://auth.example.com/connect/register",
  code_challenge_methods_supported: ["S256"],
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const unauthorizedProbe = () =>
  new Response(null, {
    status: 401,
    headers: {
      "WWW-Authenticate":
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
    },
  })

const mockFullDiscoveryAndRegistration = () => {
  fetchMock
    .mockResolvedValueOnce(unauthorizedProbe())
    .mockResolvedValueOnce(json(resourceMetadata))
    .mockResolvedValueOnce(json(authServerMetadata))
    .mockResolvedValueOnce(json({ client_id: "client-123" }))
}

describe("McpServers - oauth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let mcpServerId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [McpServersModule],
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
    auth0Id = "auth0|123"
    fetchMock.mockReset()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const createServer = async (): Promise<string> => {
    const response = await request({
      route: McpServersRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload: { name: "Knowledge Base", url: MCP_URL } },
    })
    expectResponse(response, 201)
    return response.body.data.id
  }

  const initiate = async () =>
    request({
      route: McpServersRoutes.initiateOauth,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId }),
      token: accessToken,
    })

  const complete = async (payload: typeof McpServersRoutes.completeOauth.request) =>
    request({
      route: McpServersRoutes.completeOauth,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId }),
      token: accessToken,
      request: payload,
    })

  it("initiates OAuth and returns the authorization URL", async () => {
    await createContext()
    mcpServerId = await createServer()
    mockFullDiscoveryAndRegistration()

    const response = await initiate()

    expectResponse(response, 201)
    expect(response.body.data.authorizationUrl).toMatch(
      /^https:\/\/auth\.example\.com\/oauth2\/authorize/,
    )
  })

  it("returns 400 when the MCP server does not support OAuth", async () => {
    await createContext()
    mcpServerId = await createServer()
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    const response = await initiate()

    expectResponse(response, 400)
  })

  it("completes OAuth and marks the server connected", async () => {
    await createContext()
    mcpServerId = await createServer()
    mockFullDiscoveryAndRegistration()

    const initiateResponse = await initiate()
    expectResponse(initiateResponse, 201)
    const state = new URL(initiateResponse.body.data.authorizationUrl).searchParams.get("state")
    if (!state) throw new Error("Expected a state param on the authorization URL")

    fetchMock.mockResolvedValueOnce(
      json({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, token_type: "Bearer" }),
    )

    const response = await complete({ payload: { code: "code-1", state } })

    expectResponse(response, 201)
    expect(response.body.data.authStatus).toBe("oauthConnected")
  })

  it("rejects completion with a bad state", async () => {
    await createContext()
    mcpServerId = await createServer()

    const response = await complete({ payload: { code: "code-1", state: "wrong" } })

    expectResponse(response, 400)
  })

  it("requires authentication on both routes", async () => {
    // The guard answers before any context is resolved, so no server is needed.
    mcpServerId = randomUUID()
    accessToken = undefined

    const initiateResponse = await initiate()
    expectResponse(initiateResponse, 401)

    const completeResponse = await complete({ payload: { code: "code-1", state: "state-1" } })
    expectResponse(completeResponse, 401)
  })
})
