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
import { mcpServerFactory } from "../mcp-server.factory"
import { McpServersModule } from "../mcp-servers.module"

describe("McpServers - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let mcpServerId: string
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

    const mcpServer = mcpServerFactory.build({ name: "Test Server", projectId: project.id })
    await repositories.mcpServerRepository.save(mcpServer)
    mcpServerId = mcpServer.id

    return { organization, project, mcpServer }
  }

  const subject = async () =>
    request({
      route: McpServersRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId }),
      token: accessToken,
    })

  it("should soft-delete the MCP server", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual({ success: true })

    const stored = await repositories.mcpServerRepository.findOne({
      where: { id: mcpServerId },
    })
    expect(stored).toBeNull()

    const softDeleted = await repositories.mcpServerRepository.findOne({
      where: { id: mcpServerId },
      withDeleted: true,
    })
    expect(softDeleted).not.toBeNull()
    expect(softDeleted?.deletedAt).not.toBeNull()
  })
})
