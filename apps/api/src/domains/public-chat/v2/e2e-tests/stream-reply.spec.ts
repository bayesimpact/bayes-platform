import { randomUUID } from "node:crypto"
import { PublicChatV2Routes, type StreamEventPayload } from "@caseai-connect/api-contracts"
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
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentSubAgentFactory } from "@/domains/agents/sub-agents/agent-sub-agent.factory"
import { addFeature } from "@/domains/organizations/organization.factory"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { createEmbedConfigWithSession } from "../../public-chat.factory"
import { PublicChatModule } from "../../public-chat.module"

describe("PublicChat - streamReply", () => {
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

  /** The message travels in the body, never in the URL. */
  const rawSubject = (body: unknown) =>
    request(app.getHttpServer())
      .post(PublicChatV2Routes.streamReply.getPath({ embedToken, sessionId }))
      .send(body as object)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  const subject = (content: string) => rawSubject({ payload: { content } })

  const streamedText = (text: string) =>
    parseSseDataEvents<StreamEventPayload>(text)
      .filter((event) => event.type === "chunk")
      .map((event) => event.content)
      .join("")

  it("should stream the response", async () => {
    await createContext()

    const response = await subject("Hello")
    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/^text\/event-stream/)
    expect(streamedText(response.text)).toBe("Hello, I'm the stream default mock value!")

    const userMessages = await repositories.agentMessageRepository.findBy({
      sessionId,
      role: "user",
    })
    expect(userMessages.map((message) => message.content)).toEqual(["Hello"])
  })

  it("does not read a message sent in the URL, as the GET stream of v1 does", async () => {
    await createContext()

    const response = await request(app.getHttpServer())
      .get(`/public/v2/agents/${embedToken}/sessions/${sessionId}/messages/stream`)
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(response.status).toBe(404)
    expect(await repositories.agentMessageRepository.count()).toBe(0)
  })

  it("answers a body without a payload object with one error event inside the stream", async () => {
    await createContext()

    for (const body of [{}, { payload: null }, { payload: { content: 42 } }]) {
      const response = await rawSubject(body)
      expect(response.status).toBe(200)
      expect(parseSseDataEvents<StreamEventPayload>(response.text)).toEqual([
        { type: "error", messageId: "", error: "Invalid request body" },
      ])
    }
    expect(await repositories.agentMessageRepository.count()).toBe(0)
  })

  it("does not read a message sent in the URL of the POST", async () => {
    await createContext()

    const response = await request(app.getHttpServer())
      .post(PublicChatV2Routes.streamReply.getPath({ embedToken, sessionId }))
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(parseSseDataEvents<StreamEventPayload>(response.text)).toEqual([
      { type: "error", messageId: "", error: "Invalid request body" },
    ])
    expect(await repositories.agentMessageRepository.count()).toBe(0)
  })

  it("persists the classified title and categories on the PUBLIC session (#616)", async () => {
    const { agent, session } = await createContext()
    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Billing" }),
    )

    const mockProvider = setup.module.get(AISDKMockProvider)
    mockProvider.resetMock()
    // Generation 1: the answer. Generation 2: the post-turn classification.
    mockProvider.addTextTurn(agent.id, "Here you go.")
    mockProvider.addObjectTurn(agent.id, {
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

    const mockProvider = setup.module.get(AISDKMockProvider)
    mockProvider.resetMock()
    // Turn 1: fill fullName, then answer, then the post-turn classification.
    mockProvider.addToolCallTurn(agent.id, "fillForm", { formFields: { fullName: "Ada" } })
    mockProvider.addTextTurn(agent.id, "Noted!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    const firstResponse = await subject("My name is Ada")
    expect(firstResponse.status).toBe(200)

    // Public sessions own their forms like Studio sessions do, in conversation_form.
    const readForm = () =>
      repositories.conversationFormRepository.findOneByOrFail({
        sessionId: session.id,
        agentId: agent.id,
      })
    expect((await readForm()).state).toEqual({ fullName: "Ada" })

    // Turn 2: fill city — the state must accumulate, not reset.
    mockProvider.addToolCallTurn(agent.id, "fillForm", { formFields: { city: "Paris" } })
    mockProvider.addTextTurn(agent.id, "Saved!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    const secondResponse = await subject("I live in Paris")
    expect(secondResponse.status).toBe(200)

    expect((await readForm()).state).toEqual({ fullName: "Ada", city: "Paris" })
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

  it("should return 410 SESSION_EXPIRED when the retention purge emptied the session", async () => {
    const { session } = await createContext()
    await repositories.publicAgentSessionRepository.update(session.id, { purgedAt: new Date() })

    const response = await subject("Hello")
    expect(response.status).toBe(410)
    expect(response.body.code).toBe("SESSION_EXPIRED")
  })

  it("streams a handoff as one reply: the hand-over sentence and the sub-agent's first question", async () => {
    const { organization, project, agent, session } = await createContext()
    const child = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Form Filler",
        type: "conversation",
      }),
    )
    const childSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent: child }).build({
        fillFormEnabled: true,
        outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
      }),
    )
    await repositories.agentSubAgentRepository.save(
      agentSubAgentFactory
        .transient({ organization, project, parentAgent: agent, childAgent: child })
        .tool({ toolName: "take_over_form", description: "When the visitor wants to enroll." })
        .handoff()
        .build(),
    )
    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "agent-orchestration",
    })

    const mockProvider = setup.module.get(AISDKMockProvider)
    mockProvider.resetMock()
    mockProvider.addToolCallTurn(agent.id, "take_over_form", {})
    mockProvider.addTextTurn(agent.id, "I hand you over.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(child.id, "Hello, what is your name?")
    mockProvider.addObjectTurn(child.id, { suggestedTitle: null })

    const response = await subject("I want to enroll")
    expect(response.status).toBe(200)
    const events = parseSseDataEvents<StreamEventPayload>(response.text)
    // The public contract: one start, one end per request, whatever the platform ran.
    expect(events.filter((event) => event.type === "start")).toHaveLength(1)
    const endEvents = events.filter((event) => event.type === "end")
    expect(endEvents).toHaveLength(1)
    expect(endEvents[0]).toMatchObject({
      fullContent: "I hand you over.\n\nHello, what is your name?",
    })
    expect(events.at(-1)?.type).toBe("end")

    // The session now routes the visitor's messages to the sub-agent, and each
    // reply is stored on its own, attributed to the agent that wrote it.
    const updatedSession = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.activeAgentId).toBe(child.id)
    const replies = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id, role: "assistant" },
      order: { createdAt: "ASC" },
    })
    expect(replies.map((reply) => reply.agentSettingsId)).toEqual([
      expect.any(String),
      childSettings.id,
    ])
  })
})
