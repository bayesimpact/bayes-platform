import { AgentModel } from "@bayes-platform/api-contracts"
import { DeskConversationsRoutes, type ReplyStreamEventDto } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
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
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { DeskModule } from "../../desk.module"

/**
 * A parent agent hands the conversation to a form sub-agent, the sub-agent talks to the person in
 * the same conversation until it concludes, and the parent resumes. Everything the model does
 * comes from the mock provider's scripted turns.
 */
describe("Desk conversations - streamReply with a hand-over", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const FORM_SCHEMA = {
    type: "object",
    properties: { firstName: { type: "string" }, lastName: { type: "string" } },
  }

  const createContext = async () => {
    const { user, organization, project, agent, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "Helpful Assistant", type: "conversation" },
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
    authSubject = user.authSubject!
    const child = subAgents[0]
    if (!child) throw new Error("sub-agent not created")
    return { agent, session, child }
  }

  const subject = (content: string) =>
    supertest(app.getHttpServer())
      .post(
        DeskConversationsRoutes.streamReply.getPath({
          organizationId,
          projectId,
          agentId,
          agentSessionId,
        }),
      )
      .send({ payload: { content } })
      .set("Connection", "close")
      .set("Authorization", "Bearer token")

  const repliesOf = (text: string) =>
    parseSseDataEvents<ReplyStreamEventDto>(text).flatMap((event) =>
      event.type === "end" ? [event.fullContent] : [],
    )

  it("hands the conversation to the sub-agent, lets it talk in the same conversation, and resumes the parent when it concludes", async () => {
    const { agent, session, child } = await createContext()
    const mockProvider = setup.module.get(AISDKMockProvider)
    mockProvider.resetMock()

    // Turn 1. The parent hands over, the child's first turn follows at once.
    mockProvider.addToolCallTurn(agent.id, "take_over_form", { reason: "The user wants to enroll" })
    mockProvider.addTextTurn(agent.id, "I hand you over to Form Filler.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: "Enrollment" })
    mockProvider.addTextTurn(child.subAgent.id, "Hello! What is your first name?")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })

    const first = await subject("Hello, I would like to enroll.")
    expect(first.status).toBe(200)
    expect(repliesOf(first.text)).toEqual([
      "I hand you over to Form Filler.",
      "Hello! What is your first name?",
    ])
    let persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBe(child.subAgent.id)

    // Turn 2. The child completes the form and concludes; the parent resumes at once.
    mockProvider.addToolCallTurn(child.subAgent.id, "fillForm", {
      formFields: { firstName: "John", lastName: "Doe" },
    })
    mockProvider.addToolCallTurn(child.subAgent.id, "concludeHandoff", {})
    mockProvider.addTextTurn(child.subAgent.id, "All set, I hand you back.")
    mockProvider.addObjectTurn(child.subAgent.id, { suggestedTitle: null })
    mockProvider.addTextTurn(agent.id, "Welcome John Doe!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const second = await subject("John Doe")
    expect(second.status).toBe(200)
    expect(repliesOf(second.text)).toEqual(["All set, I hand you back.", "Welcome John Doe!"])
    persisted = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(persisted.activeAgentId).toBeNull()

    const form = await repositories.conversationFormRepository.findOneByOrFail({
      sessionId: session.id,
      agentId: child.subAgent.id,
    })
    expect(form.state).toEqual({ firstName: "John", lastName: "Doe" })
    expect(form.status).toBe("concluded")

    // One transcript: each reply is attributed to the agent that wrote it.
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id },
      order: { createdAt: "ASC" },
      relations: { agentSettings: true },
    })
    expect(
      messages.filter((message) => message.role === "user").map((message) => message.content),
    ).toEqual(["Hello, I would like to enroll.", "John Doe"])
    expect(
      messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.agentSettings.agentId),
    ).toEqual([agent.id, child.subAgent.id, child.subAgent.id, agent.id])
  })
})
