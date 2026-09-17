import {
  AgentModel,
  AgentSessionMessagesRoutes,
  type StreamEventPayload,
} from "@caseai-connect/api-contracts"
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
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { createOrganizationWithAgentAndSubAgents } from "@/domains/organizations/organization.factory"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { CHILD_FIRST_TURN_TRIGGER, PARENT_RESUME_TRIGGER } from "../handoff-turn-loop"
import { StreamingModule } from "../streaming.module"

/**
 * A parent agent hands the conversation to a form sub-agent (handoff mode),
 * the sub-agent talks to the user in the same session until it concludes,
 * and the parent resumes. Everything the model does comes from the mock
 * provider's scripted turns; the platform only routes.
 */
describe("AgentSessionMessagesRoutes.stream - handoff", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const FORM_SCHEMA = {
    type: "object",
    properties: { forName: { type: "string" }, name: { type: "string" } },
  }

  const createContext = async () => {
    const { user, organization, project, agent, agentSettings, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "Orchestrator", type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
        subAgents: [
          {
            subAgent: { name: "Form Filler", type: "conversation" },
            subAgentSettings: {
              model: AgentModel._Mock,
              fillFormEnabled: true,
              outputJsonSchema: FORM_SCHEMA,
            },
            agentSubAgent: { toolName: "take_over_form", mode: "handoff" },
          },
        ],
      })
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = session.id
    auth0Id = user.auth0Id
    const child = subAgents[0]
    if (!child) throw new Error("sub-agent not created")
    return { agent, agentSettings, session, child }
  }

  const subject = (content: string) =>
    request(app.getHttpServer())
      .get(
        AgentSessionMessagesRoutes.stream.getPath({
          organizationId,
          projectId,
          agentId,
          agentSessionId,
        }),
      )
      .query({ q: JSON.stringify({ payload: { content } }) })
      .set("Connection", "close")
      .set("Authorization", "Bearer token")

  const eventsOf = (text: string) => parseSseDataEvents<StreamEventPayload>(text)

  it("hands the conversation to the sub-agent, lets it talk to the user in the same session, and resumes the parent when it concludes", async () => {
    const { agent, session, child } = await createContext()
    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()

    // Turn 1. The parent hands over, the child's first turn follows at once.
    mockProvider.addToolCallTurn(agent.id, "take_over_form", { reason: "The user wants to enroll" })
    mockProvider.addTextTurn(agent.id, "I hand you over to Form Filler.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: "Enrollment" })
    mockProvider.addTextTurn(child.subAgent.id, "Hello! What is your first name?")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })

    const first = await subject("Hello, I would like to enroll.")
    expect(first.status).toBe(200)
    const firstEvents = eventsOf(first.text)
    // Two replies in one response: the hand-over sentence, then the child's question.
    expect(firstEvents.filter((event) => event.type === "start")).toHaveLength(2)
    expect(firstEvents.filter((event) => event.type === "end")).toHaveLength(2)
    const firstTexts = firstEvents
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(firstTexts).toEqual([
      "I hand you over to Form Filler.",
      "Hello! What is your first name?",
    ])

    let persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBe(child.subAgent.id)

    // The child's first turn was triggered by the platform: no stored user message for it.
    const childPrompt = mockProvider
      .getCalls()
      .find((call) => call.agentId === child.subAgent.id && call.toolNames.length > 0)
    expect(childPrompt?.prompt).toContain(CHILD_FIRST_TURN_TRIGGER)
    expect(childPrompt?.prompt).toContain("Hand-over")
    expect(childPrompt?.toolNames).toEqual(expect.arrayContaining(["fillForm", "concludeHandoff"]))

    // Turn 2. The user's message goes to the child, which fills the form.
    mockProvider.addToolCallTurn(child.subAgent.id, "fillForm", { formFields: { forName: "John" } })
    mockProvider.addTextTurn(child.subAgent.id, "Thanks John. And your last name?")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })

    const second = await subject("John")
    expect(second.status).toBe(200)
    expect(eventsOf(second.text).filter((event) => event.type === "start")).toHaveLength(1)
    const parentCallsAfterSecond = mockProvider
      .getCalls()
      .filter((call) => call.agentId === agent.id && call.toolNames.length > 0)
    // Only the two generations of turn 1 (the tool call, then the sentence).
    expect(parentCallsAfterSecond).toHaveLength(2)

    // Turn 3. The child completes the form and concludes; the parent resumes at once.
    mockProvider.addToolCallTurn(child.subAgent.id, "fillForm", { formFields: { name: "Doe" } })
    mockProvider.addToolCallTurn(child.subAgent.id, "concludeHandoff", {})
    mockProvider.addTextTurn(child.subAgent.id, "All set, I hand you back.")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(agent.id, "Welcome John Doe!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const third = await subject("Doe")
    expect(third.status).toBe(200)
    const thirdTexts = eventsOf(third.text)
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(thirdTexts).toEqual(["All set, I hand you back.", "Welcome John Doe!"])

    persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBeNull()

    const resumePrompt = mockProvider
      .getCalls()
      .filter((call) => call.agentId === agent.id && call.toolNames.length > 0)
      .at(-1)
    expect(resumePrompt?.prompt).toContain(PARENT_RESUME_TRIGGER)

    // The form belongs to the conversation, filled by the child, and is concluded.
    const form = await repositories.conversationFormRepository.findOneByOrFail({
      sessionId: session.id,
      agentId: child.subAgent.id,
    })
    expect(form.state).toEqual({ forName: "John", name: "Doe" })
    expect(form.status).toBe("concluded")

    // One transcript: three user messages typed, five replies, each attributed to its agent.
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id },
      order: { createdAt: "ASC" },
      relations: { agentSettings: true },
    })
    expect(
      messages.filter((message) => message.role === "user").map((message) => message.content),
    ).toEqual(["Hello, I would like to enroll.", "John", "Doe"])
    expect(
      messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.agentSettings.agentId),
    ).toEqual([agent.id, child.subAgent.id, child.subAgent.id, child.subAgent.id, agent.id])
  })

  it("does not hand the conversation to a sub-agent whose form is already concluded", async () => {
    const { agent, session, child } = await createContext()
    await repositories.conversationFormRepository.save(
      repositories.conversationFormRepository.create({
        organizationId,
        projectId,
        sessionId: session.id,
        agentId: child.subAgent.id,
        agentSettingsId: child.subAgentSettings.id,
        status: "concluded",
        state: { forName: "Ada" },
      }),
    )
    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    mockProvider.addToolCallTurn(agent.id, "take_over_form", {})
    mockProvider.addTextTurn(agent.id, "Your form is already complete, Ada.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const response = await subject("Can I fill the form again?")
    expect(response.status).toBe(200)
    expect(eventsOf(response.text).filter((event) => event.type === "start")).toHaveLength(1)

    const persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBeNull()
    // The parent's second generation saw the tool's refusal with the collected state.
    const parentAnswerCall = mockProvider
      .getCalls()
      .filter((call) => call.agentId === agent.id && call.toolNames.length > 0)
      .at(-1)
    expect(parentAnswerCall?.prompt).toContain("already_concluded")
    expect(parentAnswerCall?.prompt).toContain("Ada")
  })
})
