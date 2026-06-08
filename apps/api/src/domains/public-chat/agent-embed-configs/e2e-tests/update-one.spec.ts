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
import { AgentEmbedConfig } from "../agent-embed-config.entity"
import { agentEmbedConfigFactory } from "../agent-embed-config.factory"
import { AgentEmbedConfigsManagementModule } from "../agent-embed-configs-management.module"

describe("AgentEmbedConfigs Management - PATCH one", () => {
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

    const agentEntity = await repositories.agentRepository.findOneOrFail({ where: { id: agentId } })
    const organizationEntity = await repositories.organizationRepository.findOneOrFail({
      where: { id: organizationId },
    })
    const projectEntity = await repositories.projectRepository.findOneOrFail({
      where: { id: projectId },
    })
    const config = agentEmbedConfigFactory
      .transient({ organization: organizationEntity, project: projectEntity, agent: agentEntity })
      .build({ isEnabled: false, allowedOrigins: [] })
    await repositories.agentEmbedConfigRepository.save(config)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  it("returns 200 with success and updates isEnabled", async () => {
    const response = await request({
      route: AgentEmbedConfigsRoutes.updateOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      request: { payload: { isEnabled: true } },
    })

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const updated = await setup
      .getRepository(AgentEmbedConfig)
      .findOneOrFail({ where: { agentId } })
    expect(updated.isEnabled).toBe(true)
  })

  it("updates allowedOrigins", async () => {
    const origins = ["https://app.example.com", "https://staging.example.com"]
    const response = await request({
      route: AgentEmbedConfigsRoutes.updateOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      request: { payload: { allowedOrigins: origins } },
    })

    expectResponse(response, 200)
    const updated = await setup
      .getRepository(AgentEmbedConfig)
      .findOneOrFail({ where: { agentId } })
    expect(updated.allowedOrigins).toEqual(origins)
  })

  it("updates displayMode", async () => {
    const response = await request({
      route: AgentEmbedConfigsRoutes.updateOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      request: { payload: { displayMode: "drawer" } },
    })

    expectResponse(response, 200)
    const updated = await setup
      .getRepository(AgentEmbedConfig)
      .findOneOrFail({ where: { agentId } })
    expect(updated.displayMode).toBe("drawer")
  })

  it("only updates specified fields (partial update)", async () => {
    await request({
      route: AgentEmbedConfigsRoutes.updateOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      request: { payload: { isEnabled: true } },
    })

    const afterFirst = await setup
      .getRepository(AgentEmbedConfig)
      .findOneOrFail({ where: { agentId } })
    const embedTokenAfterFirst = afterFirst.embedToken

    await request({
      route: AgentEmbedConfigsRoutes.updateOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      request: { payload: { allowedOrigins: ["https://new.example.com"] } },
    })

    const afterSecond = await setup
      .getRepository(AgentEmbedConfig)
      .findOneOrFail({ where: { agentId } })
    expect(afterSecond.isEnabled).toBe(true)
    expect(afterSecond.embedToken).toBe(embedTokenAfterFirst)
    expect(afterSecond.allowedOrigins).toEqual(["https://new.example.com"])
  })
})
