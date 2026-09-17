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
    expect(childPrompt?.prompt).toContain("Your task stops at your own scope")
    expect(childPrompt?.toolNames).toEqual(expect.arrayContaining(["fillForm", "concludeHandoff"]))
    // The child sees its own form: nothing recorded yet, every field still empty.
    expect(childPrompt?.prompt).toContain("Your form so far")
    expect(childPrompt?.prompt).toContain("nothing yet")

    // Turn 2. The user's message goes to the child, which fills the form.
    mockProvider.addToolCallTurn(child.subAgent.id, "fillForm", { formFields: { forName: "John" } })
    mockProvider.addTextTurn(child.subAgent.id, "Thanks John. And your last name?")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })

    const second = await subject("John")
    expect(second.status).toBe(200)
    // The generation after fillForm shows what was recorded and what is still empty.
    const childPromptAfterFill = mockProvider
      .getCalls()
      .filter((call) => call.agentId === child.subAgent.id && call.toolNames.length > 0)
      .at(-1)
    expect(childPromptAfterFill?.prompt).toContain("Still empty: name")
    expect(childPromptAfterFill?.prompt).not.toContain("Still empty: forName")
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

  it("concludes a hand-over the sub-agent forgot to signal, summarizes it for the parent, and tells the next sub-agent what is already known", async () => {
    const { user, organization, project, agent, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "Orchestrator", type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
        subAgents: [
          {
            subAgent: { name: "Identity", type: "conversation" },
            subAgentSettings: {
              model: AgentModel._Mock,
              fillFormEnabled: true,
              outputJsonSchema: FORM_SCHEMA,
            },
            agentSubAgent: { toolName: "take_over_identity", mode: "handoff" },
          },
          {
            subAgent: { name: "Needs", type: "conversation" },
            subAgentSettings: {
              model: AgentModel._Mock,
              fillFormEnabled: true,
              outputJsonSchema: { type: "object", properties: { need: { type: "string" } } },
            },
            agentSubAgent: { toolName: "take_over_needs", mode: "handoff" },
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
    const [identity, needs] = subAgents
    if (!identity || !needs) throw new Error("sub-agents not created")

    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()

    // Turn 1: hand-over to Identity, which fills the form and says goodbye WITHOUT
    // calling concludeHandoff. The classifier reads the conclusion and summarizes.
    mockProvider.addToolCallTurn(agent.id, "take_over_identity", {})
    mockProvider.addTextTurn(agent.id, "Identity will take it from here.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addToolCallTurn(identity.subAgent.id, "fillForm", {
      formFields: { forName: "John", name: "Doe" },
    })
    mockProvider.addTextTurn(
      identity.subAgent.id,
      "Thanks John Doe, that is all I needed. Goodbye!",
    )
    mockProvider.addObjectTurn(identity.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: true,
      handoffSummary: "The user is John Doe.",
    })
    // The parent resumes and hands over to Needs at once.
    mockProvider.addToolCallTurn(agent.id, "take_over_needs", {})
    mockProvider.addTextTurn(agent.id, "Now Needs will ask about your situation.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(needs.subAgent.id, "Hello John, what do you need today?")
    mockProvider.addObjectTurn(needs.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: false,
      handoffSummary: "",
    })

    const response = await subject("My name is John Doe")
    expect(response.status).toBe(200)
    const texts = eventsOf(response.text)
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(texts).toEqual([
      "Identity will take it from here.",
      "Thanks John Doe, that is all I needed. Goodbye!",
      "Now Needs will ask about your situation.",
      "Hello John, what do you need today?",
    ])

    // Identity's form is concluded with the classifier's summary, and the conclusion is logged.
    const identityForm = await repositories.conversationFormRepository.findOneByOrFail({
      sessionId: session.id,
      agentId: identity.subAgent.id,
    })
    expect(identityForm.status).toBe("concluded")
    expect(identityForm.summary).toBe("The user is John Doe.")
    const identityReply = await repositories.agentMessageRepository.findOne({
      where: {
        sessionId: session.id,
        role: "assistant",
        content: "Thanks John Doe, that is all I needed. Goodbye!",
      },
    })
    expect(identityReply?.toolCalls?.map((toolCall) => toolCall.name)).toEqual(
      expect.arrayContaining(["fillForm", "concludeHandoff"]),
    )

    // The parent's resumption saw what Identity collected and concluded.
    const calls = mockProvider.getCalls()
    const parentResume = calls
      .filter((call) => call.agentId === agent.id && call.toolNames.length > 0)
      .at(-1)
    expect(parentResume?.prompt).toContain("## Your sub-agents in this conversation")
    // The recorded prompt is JSON-serialized: quotes are escaped, so match on the words.
    expect(parentResume?.prompt).toContain("Identity")
    expect(parentResume?.prompt).toContain("concluded its part")
    expect(parentResume?.prompt).toContain("The user is John Doe.")
    expect(parentResume?.prompt).toContain("forName")
    expect(parentResume?.prompt).toContain("John")

    // Needs knows what Identity collected and is told not to ask again.
    const needsFirstTurn = calls.find(
      (call) => call.agentId === needs.subAgent.id && call.toolNames.length > 0,
    )
    expect(needsFirstTurn?.prompt).toContain("## Already known about the user")
    expect(needsFirstTurn?.prompt).toContain("Identity")
    expect(needsFirstTurn?.prompt).toContain("Doe")

    const persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBe(needs.subAgent.id)
  })

  it("completes the form from the sub-agent's transcript when it concludes, without overwriting what fillForm wrote", async () => {
    const { agent, session, child } = await createContext()
    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()

    // Turn 1: hand-over, the child asks for both names.
    mockProvider.addToolCallTurn(agent.id, "take_over_form", {})
    mockProvider.addTextTurn(agent.id, "Form Filler takes it from here.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(child.subAgent.id, "Hello! Your first and last name?")
    mockProvider.addObjectTurn(child.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: false,
      handoffSummary: "",
    })
    expect((await subject("Hi")).status).toBe(200)

    // Turn 2: the user gives both, the child records the first name only and
    // concludes with its tool. The consolidation reads the transcript and adds
    // the last name; its different first name does not replace the stored one.
    mockProvider.addToolCallTurn(child.subAgent.id, "fillForm", { formFields: { forName: "John" } })
    mockProvider.addToolCallTurn(child.subAgent.id, "concludeHandoff", {})
    mockProvider.addTextTurn(child.subAgent.id, "Thanks, all done.")
    mockProvider.addObjectTurn(child.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: true,
      handoffSummary: "The user is John Doe.",
    })
    mockProvider.addObjectTurn(child.subAgent.id, { forName: "Johnny", name: "Doe" })
    mockProvider.addTextTurn(agent.id, "Welcome John Doe!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const response = await subject("John Doe")
    expect(response.status).toBe(200)

    const form = await repositories.conversationFormRepository.findOneByOrFail({
      sessionId: session.id,
      agentId: child.subAgent.id,
    })
    expect(form.state).toEqual({ forName: "John", name: "Doe" })
    expect(form.status).toBe("concluded")
    expect(form.summary).toBe("The user is John Doe.")

    // The addition is logged on the child's reply, after its own tool calls.
    const childReply = await repositories.agentMessageRepository.findOne({
      where: { sessionId: session.id, role: "assistant", content: "Thanks, all done." },
    })
    const consolidation = childReply?.toolCalls?.find(
      (toolCall) => toolCall.name === "consolidateForm",
    )
    expect(consolidation?.arguments).toEqual({ name: "Doe" })

    // The extraction ran once, with the form schema, over the child's part only.
    const consolidationCall = mockProvider
      .getCalls()
      .find(
        (call) =>
          call.responseFormatSchema?.includes('"name"') && call.prompt.includes("## Transcript"),
      )
    expect(consolidationCall?.agentId).toBe(child.subAgent.id)
    expect(consolidationCall?.prompt).not.toContain("Form Filler takes it from here.")
    expect(consolidationCall?.prompt).toContain("John Doe")
  })

  it("streams the sentence once when the sub-agent repeats it after a tool result, and ends its turn on the conclusion", async () => {
    const { agent, session, child } = await createContext()
    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()

    // Turn 1: hand-over, the child asks for the name.
    mockProvider.addToolCallTurn(agent.id, "take_over_form", {})
    mockProvider.addTextTurn(agent.id, "Form Filler takes it from here.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(child.subAgent.id, "Hello! Your first name?")
    mockProvider.addObjectTurn(child.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: false,
      handoffSummary: "",
    })
    expect((await subject("Hi")).status).toBe(200)

    // Turn 2: the child writes its sentence and records the name in the same
    // generation, then writes the very same sentence again after the tool
    // result. The user reads it once.
    mockProvider.addTextWithToolCallTurn(child.subAgent.id, "Noted, thank you John.", "fillForm", {
      formFields: { forName: "John" },
    })
    mockProvider.addTextTurn(child.subAgent.id, "Noted, thank you John.")
    mockProvider.addObjectTurn(child.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: false,
      handoffSummary: "",
    })
    const second = await subject("John")
    expect(second.status).toBe(200)
    const secondTexts = eventsOf(second.text)
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(secondTexts).toEqual(["Noted, thank you John."])

    // Turn 3: the child concludes with its closing sentence in the same
    // generation. The conclusion ends its turn: no further child generation,
    // the parent resumes.
    mockProvider.addTextWithToolCallTurn(
      child.subAgent.id,
      "All done, I hand you back.",
      "concludeHandoff",
      {},
    )
    mockProvider.addTextTurn(child.subAgent.id, "THIS GENERATION MUST NOT RUN")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(agent.id, "Welcome John!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    const third = await subject("That is all")
    expect(third.status).toBe(200)
    const thirdTexts = eventsOf(third.text)
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(thirdTexts).toEqual(["All done, I hand you back.", "Welcome John!"])

    const persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBeNull()
    const storedReplies = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id, role: "assistant" },
      order: { createdAt: "ASC" },
    })
    expect(storedReplies.map((message) => message.content)).toEqual([
      "Form Filler takes it from here.",
      "Hello! Your first name?",
      "Noted, thank you John.",
      "All done, I hand you back.",
      "Welcome John!",
    ])
  })

  it("keeps the first hand-over of a turn and ends the parent's turn after its sentence", async () => {
    const { user, organization, project, agent, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "Orchestrator", type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
        subAgents: [
          {
            subAgent: { name: "First", type: "conversation" },
            subAgentSettings: { model: AgentModel._Mock },
            agentSubAgent: { toolName: "take_over_first", mode: "handoff" },
          },
          {
            subAgent: { name: "Second", type: "conversation" },
            subAgentSettings: { model: AgentModel._Mock },
            agentSubAgent: { toolName: "take_over_second", mode: "handoff" },
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
    const [first, second] = subAgents
    if (!first || !second) throw new Error("sub-agents not created")

    const mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    // The parent hands over to First, then keeps going: it writes its sentence
    // and calls Second in the same generation. Second is refused, the turn ends
    // there (no third parent generation), and First speaks next.
    mockProvider.addToolCallTurn(agent.id, "take_over_first", {})
    mockProvider.addTextWithToolCallTurn(
      agent.id,
      "First will take it from here.",
      "take_over_second",
      {},
    )
    mockProvider.addTextTurn(agent.id, "THIS GENERATION MUST NOT RUN")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(first.subAgent.id, "Hello from First.")
    mockProvider.addObjectTurn(first.subAgent.id, {
      suggestedTitle: null,
      taskConcluded: false,
      handoffSummary: "",
    })

    const response = await subject("Hello")
    expect(response.status).toBe(200)
    const texts = eventsOf(response.text)
      .filter((event) => event.type === "end")
      .map((event) => (event.type === "end" ? event.fullContent : ""))
    expect(texts).toEqual(["First will take it from here.", "Hello from First."])

    const persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBe(first.subAgent.id)

    // Two parent generations only: the hand-over, then the sentence with the refused second call.
    const parentGenerations = mockProvider
      .getCalls()
      .filter((call) => call.agentId === agent.id && call.toolNames.length > 0)
    expect(parentGenerations).toHaveLength(2)
  })
})
