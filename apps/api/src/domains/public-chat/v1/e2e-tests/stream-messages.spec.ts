import { randomUUID } from "node:crypto"
import type { StreamEventPayload } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { parseSseDataEvents } from "@/common/test/sse.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { createEmbedConfigWithSession } from "../../public-chat.factory"
import { PublicChatModule } from "../../public-chat.module"

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
    await app.close()
  })

  const createContext = async () => {
    const context = await createEmbedConfigWithSession(repositories)
    embedToken = context.embedConfig.embedToken
    sessionId = context.session.id
    sessionToken = context.sessionToken
    return context
  }

  const subject = (content: string) =>
    request(app.getHttpServer())
      .get(`/public/v1/agents/${embedToken}/sessions/${sessionId}/messages/stream`)
      .query({ q: JSON.stringify({ payload: { content } }) })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  it("should stream the response", async () => {
    await createContext()

    const response = await subject("Hello")
    expect(response.status).toBe(200)

    const events = parseSseDataEvents<StreamEventPayload>(response.text)
    expect(events.length).toBeGreaterThan(0)

    const fulltextStream = events
      .filter((event) => event.type === "chunk")
      .map((event) => event.content)
      .join("")
    expect(fulltextStream).toBe("Hello, I'm the stream default mock value!")
  })

  it("persists the mandatory report's title and categories on the PUBLIC session (#616)", async () => {
    const { agent, session } = await createContext()
    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Billing" }),
    )

    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    // Generation 1: the answer. Generation 2: the forced end-of-turn report.
    mockProvider.addTextTurn(agent.id, "Here you go.")
    mockProvider.addToolCallTurn(agent.id, "mandatory_tool", {
      suggestedTitle: "Invoice question",
      categoryNames: ["Billing"],
    })

    const response = await subject("My invoice looks wrong")
    expect(response.status).toBe(200)

    const updatedSession = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("Invoice question")
    const sessionCategories = await repositories.publicAgentSessionCategoryRepository.findBy({
      publicAgentSessionId: session.id,
    })
    expect(sessionCategories).toHaveLength(1)
    expect(sessionCategories[0]?.agentSessionCategoryId).toBe(category.id)
  })

  it("accumulates fillForm state on the PUBLIC session across turns (#616)", async () => {
    const { agent, agentSettings, session } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      fillFormEnabled: true,
      outputJsonSchema: {
        type: "object",
        properties: { fullName: { type: "string" }, city: { type: "string" } },
      },
    })

    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    // Turn 1: fill fullName, then answer, then the forced report.
    mockProvider.addToolCallTurn(agent.id, "fillForm", { formFields: { fullName: "Ada" } })
    mockProvider.addTextTurn(agent.id, "Noted!")
    mockProvider.addToolCallTurn(agent.id, "mandatory_tool", { suggestedTitle: null })
    const firstResponse = await subject("My name is Ada")
    expect(firstResponse.status).toBe(200)

    let updatedSession = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "Ada" })

    // Turn 2: fill city — the state must accumulate, not reset.
    mockProvider.addToolCallTurn(agent.id, "fillForm", { formFields: { city: "Paris" } })
    mockProvider.addTextTurn(agent.id, "Saved!")
    mockProvider.addToolCallTurn(agent.id, "mandatory_tool", { suggestedTitle: null })
    const secondResponse = await subject("I live in Paris")
    expect(secondResponse.status).toBe(200)

    updatedSession = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "Ada", city: "Paris" })
  })

  it("answers with the last published revision, not the newer draft (#636)", async () => {
    const { organization, project, agent, agentSettings, session } = await createContext()
    const draftSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1 }),
    )

    const response = await subject("Hello")
    expect(response.status).toBe(200)

    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id },
    })
    expect(messages.length).toBeGreaterThan(0)
    for (const message of messages) {
      expect(message.agentSettingsId).toBe(agentSettings.id)
      expect(message.agentSettingsId).not.toBe(draftSettings.id)
    }
  })

  it("answers an empty message with one error event inside the stream", async () => {
    await createContext()

    const response = await subject("")
    expect(response.status).toBe(200)
    expect(parseSseDataEvents<StreamEventPayload>(response.text)).toEqual([
      { type: "error", messageId: "", error: "User content must not be empty" },
    ])
  })

  it("should return 401 when invalid token", async () => {
    await createContext()
    sessionToken = "invalid_token"

    const response = await subject("Hello")
    expect(response.status).toBe(401)
  })
})
