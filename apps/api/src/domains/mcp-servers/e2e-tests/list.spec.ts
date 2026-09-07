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
import { PDF_EXPORT_BUILT_IN_NAME, PDF_EXPORT_PRESET_SLUG } from "../built-in/built-in-mcp-servers"
import { BuiltInMcpServersService } from "../built-in/built-in-mcp-servers.service"
import { McpServersModule } from "../mcp-servers.module"

describe("McpServers - list", () => {
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

  const createBuiltInServer = async () =>
    setup.module.get<BuiltInMcpServersService>(BuiltInMcpServersService).ensureBuiltInServer({
      slug: PDF_EXPORT_PRESET_SLUG,
      name: PDF_EXPORT_BUILT_IN_NAME,
      config: { url: "https://pdf-converter.example.test/mcp" },
    })

  const createServer = async (name: string, url: string) =>
    request({
      route: McpServersRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload: { name, url } },
    })

  const subject = async () =>
    request({
      route: McpServersRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return MCP servers for a project", async () => {
    await createContext()

    await createServer("Alpha Server", "https://alpha.example.com")
    await createServer("Beta Server", "https://beta.example.com")

    const response = await subject()

    expectResponse(response, 200)
    const servers = response.body.data
    expect(servers).toHaveLength(2)
    expect(servers.map((server: { name: string }) => server.name)).toEqual([
      "Alpha Server",
      "Beta Server",
    ])
  })

  it("should return empty array when project has no MCP servers", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("should return the built-in server first, with no project of its own", async () => {
    await createContext()
    await createBuiltInServer()
    await createServer("Alpha Server", "https://alpha.example.com")

    const response = await subject()

    expectResponse(response, 200)
    const servers = response.body.data
    expect(servers.map((server: { name: string }) => server.name)).toEqual([
      PDF_EXPORT_BUILT_IN_NAME,
      "Alpha Server",
    ])
    expect(servers[0]).toMatchObject({
      name: PDF_EXPORT_BUILT_IN_NAME,
      url: "https://pdf-converter.example.test/mcp",
      projectId: null,
      isBuiltIn: true,
    })
    expect(servers[1]).toMatchObject({ projectId, isBuiltIn: false })
  })

  it("should return the built-in server in every project", async () => {
    await createContext()
    const builtInServer = await createBuiltInServer()
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]).toMatchObject({ id: builtInServer.id, isBuiltIn: true })
  })
})
