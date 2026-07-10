import {
  DocumentsRagMode,
  type StreamEvent,
  type StreamEventPayload,
  ToolName,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { tool } from "ai"
import { z } from "zod"
import type { AllRepositories } from "@/common/test/test-all-repositories"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { formAgentSessionFactory } from "@/domains/agents/form-agent-sessions/form-agent-session.factory"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { StreamingService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.service"
import type { AgentSessionScope } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import {
  addFeature,
  createOrganizationWithAgent,
} from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { McpClientService } from "@/external/mcp"

const mockDocumentChunkRetrievalService = { retrieveTopChunks: jest.fn() }
const mockMcpServersService = { getEnabledServersForAgent: jest.fn() }
const mockMcpClientService = { connect: jest.fn() }

describe("Tools execution", () => {
  let service: StreamingService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder
          .overrideProvider(DocumentChunkRetrievalService)
          .useValue(mockDocumentChunkRetrievalService)
          .overrideProvider(McpServersService)
          .useValue(mockMcpServersService)
          .overrideProvider(McpClientService)
          .useValue(mockMcpClientService),
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<StreamingService>(StreamingService)
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    repositories = setup.getAllRepositories()

    jest.clearAllMocks()
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([])
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([])
  })

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
  const runWithToolCall = async ({
    agent,
    agentSettings,
    session,
    connectScope,
    toolName,
    toolInput,
  }: {
    agent: AgentSessionScope["agent"]
    agentSettings: AgentSessionScope["agentSettings"]
    session: AgentSessionScope["session"]
    connectScope: AgentSessionScope["connectScope"]
    toolName: string
    toolInput: unknown
  }) => {
    mockProvider.addToolCallTurn(agent.id, toolName, toolInput)
    mockProvider.addTextTurn(agent.id, "Done.")

    const { fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Bonjour",
        notifyClient: () => undefined,
      }),
    )
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    return { fulltextStream, agentCalls }
  }

  it("ToolName.Sources - should works", async () => {
    const { connectScope, agent, agentSettings, session, project } =
      await createContextWithSession()

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "sources-tool",
    })

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.Sources,
      toolInput: {
        sources: [
          {
            documentId: "doc-1",
            chunks: [{ chunkId: "chunk-1", partialContent: "some content" }],
          },
        ],
      },
    })

    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("Sources received")
  })

  it("ToolName.SurfaceResources - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.SurfaceResources,
      toolInput: {
        resources: [
          { id: "resource-1", title: "Guide", description: "A guide", link: "https://x.test" },
        ],
      },
    })

    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("Resources received and shown")
  })

  it("ToolName.RecalculateConversationSessionMetadata - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.RecalculateConversationSessionMetadata,
      toolInput: {
        currentCategoryNames: [],
        suggestedTitle: "About Bayes",
        categoryNames: ["Bayes"],
      },
    })

    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("Bayes")

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("About Bayes")
  })

  const createFormContextWithSession = async (result: Record<string, unknown> | null = null) => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "form" },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
        },
      },
    )
    const session = formAgentSessionFactory
      .transient({ organization, project, agent, user })
      .live()
      .build({ result })
    await repositories.formAgentSessionRepository.save(session)
    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      agentSettings,
      session,
    }
  }

  it("ToolName.FillForm - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createFormContextWithSession()

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.FillForm,
      toolInput: { formFields: { fullName: "John" } },
    })

    const updatedSession = await repositories.formAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "John" })
  })

  it("ToolName.FillForm - should works - getFormState", async () => {
    const { connectScope, agent, agentSettings, session } = await createFormContextWithSession({
      fullName: "Lara Croft",
    })

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.FillForm,
      toolInput: { getFormState: true },
    })
    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("Lara Croft")
  })

  it("ToolName.RetrieveProjectDocumentChunks - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([])

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings: ragAgentSettings,
      session,
      connectScope,
      toolName: ToolName.RetrieveProjectDocumentChunks,
      toolInput: { conversationSummary: "", latestUserQuestion: "What is Bayes?", topK: 5 },
    })

    expect(mockDocumentChunkRetrievalService.retrieveTopChunks).toHaveBeenCalledWith(
      expect.objectContaining({ latestUserQuestion: "What is Bayes?", topK: 5 }),
    )
    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("retrievalMetadata")
  })

  it("ToolName.McpSearchResources - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const searchResourcesExecute = jest.fn().mockResolvedValue({ items: ["resource-1"] })
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([{ url: "http://mcp.test" }])
    mockMcpClientService.connect.mockResolvedValue({
      tools: {
        [ToolName.McpSearchResources]: tool({
          description: "Search resources",
          inputSchema: z.object({ query: z.string() }),
          execute: searchResourcesExecute,
        }),
      },
      close: jest.fn(),
    })

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.McpSearchResources,
      toolInput: { query: "insurance" },
    })

    expect(searchResourcesExecute).toHaveBeenCalled()
    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("resource-1")
  })

  it("ToolName.McpSmartSearch - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const smartSearchExecute = jest.fn().mockResolvedValue({ answer: "smart answer" })
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([{ url: "http://mcp.test" }])
    mockMcpClientService.connect.mockResolvedValue({
      tools: {
        [ToolName.McpSmartSearch]: tool({
          description: "Smart search",
          inputSchema: z.object({ query: z.string() }),
          execute: smartSearchExecute,
        }),
      },
      close: jest.fn(),
    })

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.McpSmartSearch,
      toolInput: { query: "how to file a claim" },
    })

    expect(smartSearchExecute).toHaveBeenCalled()
    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.prompt).toContain("smart answer")
  })
})
