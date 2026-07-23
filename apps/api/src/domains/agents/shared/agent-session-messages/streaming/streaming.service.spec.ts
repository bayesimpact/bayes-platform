import {
  AgentModel,
  type StreamEvent,
  type StreamEventPayload,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { v4 } from "uuid"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { AgentMessageAttachmentDocumentsService } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-documents.service"
import type { AgentSessionScope } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import {
  addFeature,
  createOrganizationWithAgent,
  createOrganizationWithAgentAndSubAgents,
} from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { StreamingModule } from "./streaming.module"
import { StreamingService } from "./streaming.service"

describe("StreamingService", () => {
  let service: StreamingService
  let agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<StreamingService>(StreamingService)
    agentMessageAttachmentDocumentsService =
      setup.module.get<AgentMessageAttachmentDocumentsService>(
        AgentMessageAttachmentDocumentsService,
      )
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    repositories = setup.getAllRepositories()
  })

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "conversation" },
      },
    )
    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      agentSettings,
    }
  }
  const createContextWithSession = async () => {
    const { organization, project, agent, agentSettings, conversationAgentSession } =
      await createOrganizationWithAgent(repositories, {
        agent: { type: "conversation" },
        withLiveConversationAgentSession: true,
      })

    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      organization,
      project,
      agent,
      agentSettings,
      session: conversationAgentSession as ConversationAgentSession,
    }
  }

  const aggregateStream = async (
    generator: AsyncGenerator<StreamEvent, void, unknown>,
  ): Promise<{ fulltextStream: string; events: StreamEventPayload[] }> => {
    const events: StreamEventPayload[] = []
    let fulltextStream: string = ""
    for await (const event of generator) {
      const eventData = JSON.parse(event.data) as StreamEventPayload
      events.push(eventData)
      if (eventData.type === "chunk") {
        fulltextStream += eventData.content
      }
    }
    return { events, fulltextStream }
  }

  it("streamPublicAgentResponse", async () => {
    const { connectScope, agent, agentSettings } = await createContext()
    const publicSessionId = v4()
    const notifyClient = jest.fn()

    const stream = service.streamPublicAgentResponse({
      connectScope,
      publicSessionId,
      agent,
      agentSettings,
      userContent: "Bonjour",
      notifyClient,
    })

    const { events, fulltextStream } = await aggregateStream(stream)
    expect(events.length).toBeGreaterThan(0)
    expect(fulltextStream).toBe(`Hello, I'm the stream default mock value!`)
  })
  it("streamAgentResponse", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const notifyClient = jest.fn()

    const agentSessionScope: AgentSessionScope = {
      connectScope,
      session,
      agent,
      agentSettings,
    }

    const stream = service.streamAgentResponse({
      agentSessionScope,
      userContent: "Bonjour",
      notifyClient,
    })

    const { events, fulltextStream } = await aggregateStream(stream)
    expect(events.length).toBeGreaterThan(0)
    expect(fulltextStream).toBe(`Hello, I'm the stream default mock value!`)
  })
  it("streamAgentResponse - with document - pdf", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const notifyClient = jest.fn()

    const createdAttachmentDocument =
      await agentMessageAttachmentDocumentsService.createAttachmentDocument({
        attachmentDocumentId: "00000000-0000-4000-8000-000000000001",
        connectScope,
        fields: {
          fileName: "attachment.pdf",
          mimeType: "application/pdf",
          size: 1234,
          storageRelativePath: `${connectScope.organizationId}/${connectScope.projectId}/attachment.pdf`,
        },
      })

    const agentSessionScope: AgentSessionScope = {
      connectScope,
      session,
      agent,
      agentSettings,
    }

    const stream = service.streamAgentResponse({
      agentSessionScope,
      userContent: "Bonjour",
      notifyClient,
      attachmentDocumentId: createdAttachmentDocument.id,
    })

    const { events, fulltextStream } = await aggregateStream(stream)
    expect(events.length).toBeGreaterThan(0)
    expect(fulltextStream).toBe(`Hello, I'm the stream default mock value!`)
  })

  it("streamAgentResponse - with document - jpg", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const notifyClient = jest.fn()

    const createdAttachmentDocument =
      await agentMessageAttachmentDocumentsService.createAttachmentDocument({
        attachmentDocumentId: "00000000-0000-4000-8000-000000000001",
        connectScope,
        fields: {
          fileName: "attachment.jpg",
          mimeType: "image/jpg",
          size: 1234,
          storageRelativePath: `${connectScope.organizationId}/${connectScope.projectId}/attachment.pdf`,
        },
      })

    const agentSessionScope: AgentSessionScope = {
      connectScope,
      session,
      agent,
      agentSettings,
    }

    const stream = service.streamAgentResponse({
      agentSessionScope,
      userContent: "Bonjour",
      notifyClient,
      attachmentDocumentId: createdAttachmentDocument.id,
    })

    const { events, fulltextStream } = await aggregateStream(stream)
    expect(events.length).toBeGreaterThan(0)
    expect(fulltextStream).toBe(`Hello, I'm the stream default mock value!`)
  })

  it("streamAgentResponse - with fillForm-enabled sub-agent", async () => {
    const { organization, project, user, agent, agentSettings, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "MetaAgent", type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
        subAgents: [
          {
            subAgent: { name: "SubAgentForm", type: "conversation" },
            subAgentSettings: {
              model: AgentModel._Mock,
              fillFormEnabled: true,
              outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
            },
            agentSubAgent: { toolName: "call_subAgentForm" },
          },
        ],
      })
    const subAgent = subAgents[0]!.subAgent

    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .live()
      .build()
    await repositories.conversationAgentSessionRepository.save(session)

    mockProvider.addToolCallTurn(agent.id, "call_subAgentForm", {
      task: "Collect the user's form",
      context: "",
    })
    mockProvider.addTextTurn(agent.id, "parent_answer")
    mockProvider.addTextTurn(subAgent.id, "sub_answer")

    const agentSessionScope: AgentSessionScope = {
      connectScope: { organizationId: organization.id, projectId: project.id },
      session,
      agent,
      agentSettings,
    }
    const notifs: Extract<StreamEvent, { type: "notify_client" }>[] = []

    const stream = service.streamAgentResponse({
      agentSessionScope,
      userContent: "Bonjour",
      notifyClient: (event) => {
        notifs.push(event)
      },
    })

    const { events, fulltextStream } = await aggregateStream(stream)

    expect(events.length).toBeGreaterThan(0)
    expect(fulltextStream).toBe("parent_answer")

    const notifiedToolNames = notifs.map(
      (notif) => (JSON.parse(notif.data) as { toolName: string }).toolName,
    )
    expect(notifiedToolNames).toContain("call_subAgentForm")

    const toolMessages = await repositories.agentMessageRepository.find({
      where: { sessionId: session.id, role: "tool" },
    })
    expect(
      toolMessages.some((message) => message.toolCalls?.[0]?.name === "call_subAgentForm"),
    ).toBe(true)

    const calls = mockProvider.getCalls()
    const subAgentCall = calls.find((call) => call.agentId === subAgent.id)
    expect(subAgentCall?.prompt).toContain("Collect the user's form")
    const parentCalls = calls.filter((call) => call.agentId === agent.id)
    expect(parentCalls).toHaveLength(2)
    expect(parentCalls[1]?.prompt).toContain("sub_answer")
  })

  it("streamAgentResponse - with fillForm-enabled sub-agent and conversation sub-agent", async () => {
    const { organization, project, user, agent, agentSettings, subAgents } =
      await createOrganizationWithAgentAndSubAgents(repositories, {
        agent: { name: "MetaAgent", type: "conversation" },
        agentSettings: { model: AgentModel._Mock },
        subAgents: [
          {
            subAgent: { name: "FormFiller", type: "conversation" },
            subAgentSettings: {
              model: AgentModel._Mock,
              fillFormEnabled: true,
              outputJsonSchema: {
                type: "object",
                properties: { forName: { type: "string" }, name: { type: "string" } },
              },
            },
            agentSubAgent: { toolName: "call_form" },
          },
          {
            subAgent: { name: "Completed", type: "conversation" },
            subAgentSettings: { model: AgentModel._Mock },
            agentSubAgent: { toolName: "call_completed" },
          },
        ],
      })
    const formFillerAgent = subAgents[0]!.subAgent
    const completedAgent = subAgents[1]!.subAgent

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "agent-orchestration",
    })

    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .live()
      .build()
    await repositories.conversationAgentSessionRepository.save(session)

    const connectScope = { organizationId: organization.id, projectId: project.id }

    const runTurn = async (userContent: string) => {
      const agentSessionScope: AgentSessionScope = { connectScope, session, agent, agentSettings }
      const { fulltextStream } = await aggregateStream(
        service.streamAgentResponse({
          agentSessionScope,
          userContent,
          notifyClient: () => undefined,
        }),
      )
      return fulltextStream
    }

    mockProvider.addToolCallTurn(agent.id, "call_form", {
      task: "L'utilisateur dit bonjour. Démarre le remplissage du formulaire.",
      context: "",
    })
    mockProvider.addTextTurn(agent.id, "Bonjour. Quel est ton prénom ?")
    mockProvider.addTextTurn(formFillerAgent.id, "Le formulaire est vide. Demande le prénom.")

    expect(await runTurn("bonjour")).toBe("Bonjour. Quel est ton prénom ?")

    mockProvider.addToolCallTurn(agent.id, "call_form", {
      task: "L'utilisateur donne son prénom: John",
      context: "",
    })
    mockProvider.addTextTurn(agent.id, "Merci John. Quel est ton nom de famille ?")
    mockProvider.addToolCallTurn(formFillerAgent.id, "fillForm", {
      formFields: { forName: "John" },
    })
    mockProvider.addTextTurn(formFillerAgent.id, "Prénom enregistré (John). Il manque le nom.")

    expect(await runTurn("John")).toBe("Merci John. Quel est ton nom de famille ?")

    mockProvider.addToolCallTurn(agent.id, "call_form", {
      task: "L'utilisateur donne son nom: Doe",
      context: "",
    })
    mockProvider.addToolCallTurn(agent.id, "call_completed", {
      task: "Le formulaire est complet (John Doe). Souhaite la bienvenue.",
      context: "",
    })
    mockProvider.addTextTurn(agent.id, "Parfait John Doe, ton formulaire est complet !")
    mockProvider.addToolCallTurn(formFillerAgent.id, "fillForm", { formFields: { name: "Doe" } })
    mockProvider.addTextTurn(formFillerAgent.id, "Nom enregistré (Doe). Formulaire complet.")
    mockProvider.addTextTurn(completedAgent.id, "Bienvenue John Doe !")

    expect(await runTurn("Doe")).toBe("Parfait John Doe, ton formulaire est complet !")

    const formSubSession = await repositories.conversationAgentSessionRepository.findOne({
      where: { parentSessionId: session.id, agentId: formFillerAgent.id },
    })
    expect(formSubSession?.result).toEqual({ forName: "John", name: "Doe" })

    const calls = mockProvider.getCalls()

    expect(
      calls.filter((call) => call.agentId === formFillerAgent.id).length,
    ).toBeGreaterThanOrEqual(3)
    const completedCalls = calls.filter((call) => call.agentId === completedAgent.id)
    expect(completedCalls).toHaveLength(1)
    expect(completedCalls[0]?.prompt).toContain("Le formulaire est complet")
  })
})
