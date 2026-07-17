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
import { agentFactory } from "@/domains/agents/agent.factory"
import { AgentsModule } from "@/domains/agents/agents.module"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { mcpServerFactory } from "../mcp-server.factory"
import { McpServersModule } from "../mcp-servers.module"

describe("McpServers - agent linking", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let mcpServerId: string
  let agentId: string
  let accessToken: string | undefined = "token"
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

    const agent = agentFactory.transient({ organization, project }).build({ name: "Test Agent" })
    await repositories.agentRepository.save(agent)
    await addUserToAgent({ repositories, agent, user })
    agentId = agent.id

    return { organization, project, mcpServer, agent }
  }

  it("should enable an MCP server for an agent", async () => {
    await createContext()

    const response = await request({
      route: McpServersRoutes.enableForAgent,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId, agentId }),
      token: accessToken,
    })

    expectResponse(response, 201)

    const junction = await repositories.agentMcpServerRepository.findOne({
      where: { agentId, mcpServerId },
    })
    expect(junction).not.toBeNull()
    expect(junction?.enabled).toBe(true)
  })

  it("should disable an MCP server for an agent", async () => {
    await createContext()

    await repositories.agentMcpServerRepository.save(
      repositories.agentMcpServerRepository.create({ agentId, mcpServerId, enabled: true }),
    )

    const response = await request({
      route: McpServersRoutes.disableForAgent,
      pathParams: removeNullish({ organizationId, projectId, mcpServerId, agentId }),
      token: accessToken,
    })

    expectResponse(response, 200)

    const junction = await repositories.agentMcpServerRepository.findOne({
      where: { agentId, mcpServerId },
    })
    expect(junction).toBeNull()
  })
})
