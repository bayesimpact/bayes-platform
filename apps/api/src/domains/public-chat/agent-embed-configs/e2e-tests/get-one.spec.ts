import { randomUUID } from "node:crypto"
import { AgentEmbedConfigsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentEmbedConfigFactory } from "../agent-embed-config.factory"
import { AgentEmbedConfigsManagementModule } from "../agent-embed-configs-management.module"

describe("AgentEmbedConfigs Management - GET one", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentEmbedConfigsManagementModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = `auth0|${randomUUID()}`
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
      organizationMembership: { role: "member" },
      projectMembership: { role: "owner" },
      agentMembership: { role: "owner" },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  it("returns 200 with the embed config when it already exists", async () => {
    const agent = await repositories.agentRepository.findOneOrFail({ where: { id: agentId } })
    const organization = await repositories.organizationRepository.findOneOrFail({
      where: { id: organizationId },
    })
    const project = await repositories.projectRepository.findOneOrFail({ where: { id: projectId } })
    const existingConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true, allowedOrigins: ["https://example.com"] })
    await repositories.agentEmbedConfigRepository.save(existingConfig)

    const response = await request({
      route: AgentEmbedConfigsRoutes.getOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

    expectResponse(response, 200)
    expect(response.body.data.agentId).toBe(agentId)
    expect(response.body.data.isEnabled).toBe(true)
    expect(response.body.data.allowedOrigins).toEqual(["https://example.com"])
    expect(response.body.data.embedToken).toBeDefined()
  })

  it("lazily creates and returns a new embed config when none exists", async () => {
    const response = await request({
      route: AgentEmbedConfigsRoutes.getOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

    expectResponse(response, 200)
    expect(response.body.data.agentId).toBe(agentId)
    expect(response.body.data.isEnabled).toBe(false)
    expect(response.body.data.allowedOrigins).toEqual([])
    expect(response.body.data.embedToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("returns the same embed config on repeated calls (idempotent)", async () => {
    const first = await request({
      route: AgentEmbedConfigsRoutes.getOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })
    const second = await request({
      route: AgentEmbedConfigsRoutes.getOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

    expect(first.body.data.id).toBe(second.body.data.id)
    expect(first.body.data.embedToken).toBe(second.body.data.embedToken)
  })
})
