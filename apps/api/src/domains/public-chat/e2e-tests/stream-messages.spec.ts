import { randomUUID } from "node:crypto"
import type { StreamEventPayload } from "@caseai-connect/api-contracts"
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
import { publicAgentSessionFactory } from "../public-agent-sessions/public-agent-session.factory"
import { PublicChatModule } from "../public-chat.module"

describe("PublicChat - streamMessages", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

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
    sessionId = randomUUID()
    sessionToken = randomUUID()
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

    const knownToken = randomUUID()
    const session = publicAgentSessionFactory
      .transient({ embedConfig, sessionToken: knownToken })
      .build()
    await repositories.publicAgentSessionRepository.save(session)

    embedToken = embedConfig.embedToken
    sessionId = session.id
    sessionToken = knownToken

    return { organization, project, agent, agentSettings, embedConfig, session }
  }

  const subject = (content: string) =>
    request(app.getHttpServer())
      .get(`/public/agents/${embedToken}/sessions/${sessionId}/messages/stream`)
      .query({ q: JSON.stringify({ payload: { content } }) })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  const parseSseEvents = (text: string): StreamEventPayload[] =>
    text
      .split("\n\n")
      .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice("data:".length).trim()) as StreamEventPayload)

  it("should stream the response", async () => {
    await createContext()

    const response = await subject("Hello")
    expect(response.status).toBe(200)

    const events = parseSseEvents(response.text)
    expect(events.length).toBeGreaterThan(0)

    const fulltextStream = events
      .filter((event) => event.type === "chunk")
      .map((event) => event.content)
      .join("")
    expect(fulltextStream).toBe("Hello, I'm the stream default mock value!")
  })

  it("should return error when empty content", async () => {
    await createContext()

    const response = await subject("")
    expect(response.status).toBe(200)
    expect(response.text).toContain("event: error")
  })

  it("should return 401 when invalid token", async () => {
    await createContext()
    sessionToken = "invalid_token"

    const response = await subject("Hello")
    expect(response.status).toBe(401)
  })
})
