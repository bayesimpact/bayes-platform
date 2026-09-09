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
import { McpServer } from "../mcp-server.entity"
import { McpServersModule } from "../mcp-servers.module"
import { McpServersService } from "../mcp-servers.service"

describe("McpServers - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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

  const subject = async (payload?: typeof McpServersRoutes.createOne.request) =>
    request({
      route: McpServersRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create an MCP server and return it", async () => {
    await createContext()

    const response = await subject({
      payload: {
        name: "Knowledge Base",
        url: "https://mcp.example.com",
        headers: { "X-Api-Version": "2" },
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("Knowledge Base")
    expect(response.body.data.projectId).toBe(projectId)
    expect(response.body.data.id).toBeDefined()
    expect(response.body.data.authStatus).toBe("none")

    const stored = await setup.getRepository(McpServer).findOne({
      where: { id: response.body.data.id },
    })
    expect(stored).not.toBeNull()
    expect(stored?.name).toBe("Knowledge Base")

    const mcpServersService = setup.module.get(McpServersService)
    const config = mcpServersService.getConfig(stored!)
    expect(config.headers).toEqual({ "X-Api-Version": "2" })
  })

  it("should store the api key and report apiKey status for the apiKey method", async () => {
    await createContext()

    const response = await subject({
      payload: {
        name: "Keyed",
        url: "https://mcp.example.com",
        authMethod: "apiKey",
        apiKey: "secret-key",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.authStatus).toBe("apiKey")

    const stored = await setup.getRepository(McpServer).findOneOrFail({
      where: { id: response.body.data.id },
    })
    const config = setup.module.get(McpServersService).getConfig(stored)
    expect(config.apiKey).toBe("secret-key")
    expect(config.authMethod).toBe("apiKey")
  })

  it("should reject the apiKey method without a key", async () => {
    await createContext()

    const response = await subject({
      payload: { name: "Keyless", url: "https://mcp.example.com", authMethod: "apiKey" },
    })

    expectResponse(response, 400)
  })

  it("should report oauthPending for the oauth method before authorization", async () => {
    await createContext()

    const response = await subject({
      payload: { name: "OAuth server", url: "https://mcp.example.com", authMethod: "oauth" },
    })

    expectResponse(response, 201)
    expect(response.body.data.authStatus).toBe("oauthPending")

    const stored = await setup.getRepository(McpServer).findOneOrFail({
      where: { id: response.body.data.id },
    })
    const config = setup.module.get(McpServersService).getConfig(stored)
    expect(config.authMethod).toBe("oauth")
    expect(config.apiKey).toBeUndefined()
  })

  it("should report none status for the none method and drop any key", async () => {
    await createContext()

    const response = await subject({
      payload: {
        name: "Open server",
        url: "https://mcp.example.com",
        authMethod: "none",
        apiKey: "ignored",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.authStatus).toBe("none")

    const stored = await setup.getRepository(McpServer).findOneOrFail({
      where: { id: response.body.data.id },
    })
    const config = setup.module.get(McpServersService).getConfig(stored)
    expect(config.authMethod).toBe("none")
    expect(config.apiKey).toBeUndefined()
  })

  it("should reject creation without a name", async () => {
    await createContext()

    const response = await subject({
      payload: { name: "", url: "https://mcp.example.com" },
    })

    expectResponse(response, 400)
  })

  it("should reject creation with an invalid URL", async () => {
    await createContext()

    const response = await subject({
      payload: { name: "Test Server", url: "not-a-url" },
    })

    expectResponse(response, 400)
  })
})
