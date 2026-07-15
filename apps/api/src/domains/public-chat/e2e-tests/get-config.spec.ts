import { randomUUID } from "node:crypto"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentEmbedConfigFactory } from "../agent-embed-configs/agent-embed-config.factory"
import { PublicChatModule } from "../public-chat.module"

describe("PublicChat - getConfig", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    embedToken = randomUUID()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)
    embedToken = embedConfig.embedToken
    return { organization, project, agent, agentSettings, embedConfig }
  }

  const subject = () =>
    request(app.getHttpServer())
      .get(`/public/agents/${embedToken}/config`)
      .set("Connection", "close")

  it("should return config", async () => {
    const { embedConfig } = await createContext()
    const response = await subject()

    expect(response.status).toBe(200)
    expect(response.body.data.agentName).toBe(embedConfig.agent.name)
    expect(response.body.data.title).toBe(embedConfig.title)
    expect(response.body.data.logoUrl).toBe(embedConfig.logoUrl)
    expect(response.body.data.primaryColor).toBe(embedConfig.primaryColor)
  })
})
