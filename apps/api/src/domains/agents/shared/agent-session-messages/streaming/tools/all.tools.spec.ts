import {
  DocumentsRagMode,
  type StreamEvent,
  type StreamEventPayload,
  ToolName,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { tool } from "ai"
import { v4 } from "uuid"
import { z } from "zod"
import type { LLMConfig, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { AllRepositories } from "@/common/test/test-all-repositories"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { StreamingLlmService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service"
import type { AgentSessionScope } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { ToolsService } from "@/domains/agents/shared/agent-session-messages/streaming/tools.service"
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import {
  addFeature,
  createOrganizationWithAgent,
} from "@/domains/organizations/organization.factory"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { McpClientService } from "@/external/mcp"
import { DEFAULT_TOP_K } from "./lookup-knowledge-base.tool"

const mockDocumentChunkRetrievalService = { retrieveTopChunks: jest.fn() }
const mockMcpServersService = { getEnabledServersForAgent: jest.fn() }
const mockMcpClientService = { connect: jest.fn() }

describe("Tools execution", () => {
  let service: StreamingLlmService
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
    service = setup.module.get<StreamingLlmService>(StreamingLlmService)
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
    mockProvider.resetMock()
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)

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
    // Every conversation agent gets the post-turn classification (title):
    // a third, structured-output generation after the answer.
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const { fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Hello",
        notifyClient: () => undefined,
      }),
    )
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    return { fulltextStream, agentCalls }
  }

  const retrievedChunkFixture = {
    chunkId: "3f9f2f6e-0000-4000-8000-000000000001",
    documentId: "3f9f2f6e-0000-4000-8000-000000000002",
    documentTitle: "Employee Handbook",
    documentFileName: "handbook.pdf",
    documentSourceType: "project",
    chunkIndex: 0,
    content: "Employees get 27 days of paid leave.",
    distance: 0.1,
    modelName: "embedding-model",
    isParentChunk: false,
  }

  const createRagContextWithSources = async () => {
    const context = await createContextWithSession()
    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: context.project.id,
      featureFlagKey: "sources-tool",
    })
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([retrievedChunkFixture])
    return {
      ...context,
      agentSettings: { ...context.agentSettings, documentsRagMode: DocumentsRagMode.All },
    }
  }

  const findToolMessages = async (sessionId: string, toolName: string) => {
    const toolMessages = await repositories.agentMessageRepository.find({
      where: { sessionId, role: "tool" },
    })
    return toolMessages.filter((message) => message.toolCalls?.[0]?.name === toolName)
  }

  it("Sources - inline citations are stripped from the reply and logged as sources", async () => {
    const { connectScope, agent, agentSettings, session } = await createRagContextWithSources()

    // Generation 1: the lookup. Generation 2: the answer, citing inline.
    // Generation 3: the post-turn classification (title only — the sources
    // were cited inline, so the classifier is not asked about them).
    mockProvider.addToolCallTurn(agent.id, ToolName.LookupKnowledgeBase, { query: "paid leave" })
    mockProvider.addStreamTurn(agent.id, ["You get 27 days of paid leave [c", "1].", " Enjoy!"])
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: "Paid leave" })

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "How many days of leave?",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("You get 27 days of paid leave. Enjoy!")
    expect(events.at(-1)?.type).toBe("end")

    const [sourcesMessage, ...otherSources] = await findToolMessages(session.id, ToolName.Sources)
    expect(otherSources).toHaveLength(0)
    const sources = sourcesMessage?.toolCalls?.[0]?.arguments.sources as Array<{
      documentId: string
      chunks: Array<{ chunkId: string }>
    }>
    expect(sources[0]?.documentId).toBe(retrievedChunkFixture.documentId)
    expect(sources[0]?.chunks[0]?.chunkId).toBe(retrievedChunkFixture.chunkId)

    const persistedReply = await repositories.agentMessageRepository.findOneByOrFail({
      sessionId: session.id,
      role: "assistant",
    })
    expect(persistedReply.content).toBe("You get 27 days of paid leave. Enjoy!")

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(3)
    // The answering loop declares no bookkeeping tool, and the lookup tool
    // carries the inline citation rule.
    expect(agentCalls[0]?.toolNames).toContain(ToolName.LookupKnowledgeBase)
    expect(agentCalls[0]?.toolNames).not.toContain("mandatory_tool")
    expect(agentCalls[0]?.prompt).toContain("Cite your sources inline")
    // The classifier is a structured-output call with no tools, and it is
    // not asked about sources when they were cited inline.
    expect(agentCalls[2]?.toolNames).toEqual([])
    expect(agentCalls[2]?.responseFormatSchema).toContain("suggestedTitle")
    expect(agentCalls[2]?.responseFormatSchema).not.toContain("chunkIds")
  }, 15000)

  it("Sources - without inline citations, the classifier attributes the retrieved passages", async () => {
    const { connectScope, agent, agentSettings, session } = await createRagContextWithSources()

    mockProvider.addToolCallTurn(agent.id, ToolName.LookupKnowledgeBase, { query: "paid leave" })
    mockProvider.addTextTurn(agent.id, "You get 27 days of paid leave.")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: "Paid leave", chunkIds: ["c1"] })

    const { events } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "How many days of leave?",
        notifyClient: () => undefined,
      }),
    )
    expect(events.at(-1)?.type).toBe("end")

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(3)
    // The classifier schema lists the retrieved aliases as a closed enum and
    // its prompt carries the passage excerpts.
    expect(agentCalls[2]?.responseFormatSchema).toContain("chunkIds")
    expect(agentCalls[2]?.responseFormatSchema).toContain('"c1"')
    expect(agentCalls[2]?.prompt).toContain("Employees get 27 days of paid leave.")

    const sourcesMessages = await findToolMessages(session.id, ToolName.Sources)
    expect(sourcesMessages).toHaveLength(1)
    const sources = sourcesMessages[0]?.toolCalls?.[0]?.arguments.sources as Array<{
      documentId: string
    }>
    expect(sources[0]?.documentId).toBe(retrievedChunkFixture.documentId)
  }, 15000)

  it("Sources - no lookup in the turn: the classifier is not asked about passages", async () => {
    const { connectScope, agent, agentSettings, session } = await createRagContextWithSources()

    // Greeting turn on a RAG agent: answer, then the classification.
    mockProvider.addTextTurn(agent.id, "Hello!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    const { events } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "hi",
        notifyClient: () => undefined,
      }),
    )
    expect(events.at(-1)?.type).toBe("end")

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    expect(agentCalls[1]?.responseFormatSchema).not.toContain("chunkIds")
    expect(await findToolMessages(session.id, ToolName.Sources)).toHaveLength(0)
  }, 15000)

  it("Session metadata - the classification updates the title and categories on every turn", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    // Generation 1: the answer, with no tool call at all. Generation 2: the
    // classification — the model has no way to skip it.
    mockProvider.addTextTurn(agent.id, "Answer without any tool call.")
    mockProvider.addObjectTurn(agent.id, {
      suggestedTitle: "About Bayes",
      categoryNames: ["Bayes"],
    })

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Hello",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Answer without any tool call.")
    expect(events.at(-1)?.type).toBe("end")

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    // The categories are a closed enum in the classifier schema.
    expect(agentCalls[1]?.responseFormatSchema).toContain('"enum":["Bayes"]')
    expect(agentCalls[1]?.prompt).toContain("Available categories: Bayes")

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("About Bayes")
    const metadataMessages = await findToolMessages(
      session.id,
      ToolName.RecalculateConversationSessionMetadata,
    )
    expect(metadataMessages).toHaveLength(1)
    expect(metadataMessages[0]?.toolCalls?.[0]?.arguments).toEqual({
      suggestedTitle: "About Bayes",
      categoryNames: ["Bayes"],
    })
  }, 15000)

  it("Session metadata - a failing classification never breaks the stream", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const initialTitle = session.title

    mockProvider.addTextTurn(agent.id, "Answer.")
    mockProvider.addErrorTurn(agent.id, new Error("provider down"))

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Hello",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Answer.")
    expect(events.at(-1)?.type).toBe("end")
    expect(events.some((event) => event.type === "error")).toBe(false)
    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe(initialTitle)
  }, 15000)

  it("master prompt - no bookkeeping protocol, the date stays the final section", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    mockProvider.addTextTurn(agent.id, "Hello!")
    mockProvider.addObjectTurn(agent.id, { suggestedTitle: null })

    await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "hi",
        notifyClient: () => undefined,
      }),
    )

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    const systemContent =
      (JSON.parse(agentCalls[0]?.prompt ?? "[]") as Array<{ content: string }>)[0]?.content ?? ""
    expect(systemContent).not.toContain("Response protocol")
    expect(systemContent).not.toContain("mandatory")
    expect(systemContent).toMatch(/Today's date: \d{4}-\d{2}-\d{2} \(Date format YYYY-MM-DD\)\s*$/)
    // The classifier reads its own short prompt, not the agent's.
    expect(agentCalls[1]?.prompt).toContain("You are a classifier")
    expect(agentCalls[1]?.prompt).not.toContain("Today's date")
  }, 15000)

  it("ToolName.SurfaceResources - resolves prompt aliases server-side, no id or link in the prompt", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.SurfaceResources,
      // The model only ever cites the alias listed in the prompt.
      toolInput: { resourceIds: ["r1"] },
    })

    expect(agentCalls).toHaveLength(3)
    expect(agentCalls[1]?.prompt).toContain("Resources received and shown")
    // The prompt lists the resource under its alias, without its real id
    // or link (recitable links were leaking into user-visible answers).
    expect(agentCalls[0]?.prompt).toContain("r1: ")
    expect(agentCalls[0]?.prompt).not.toContain("link:")
  })

  const fillFormOutputJsonSchema = {
    type: "object",
    properties: { fullName: { type: "string" }, city: { type: "string" } },
  }

  const createFillFormContextWithSession = async (
    result: Record<string, unknown> | null = null,
  ) => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "conversation" },
        agentSettings: { fillFormEnabled: true, outputJsonSchema: fillFormOutputJsonSchema },
      },
    )
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .live()
      .build({ result })
    await repositories.conversationAgentSessionRepository.save(session)
    return {
      connectScope: { organizationId: organization.id, projectId: project.id },
      agent,
      agentSettings,
      session,
    }
  }

  it("ToolName.FillForm - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createFillFormContextWithSession()

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.FillForm,
      toolInput: { formFields: { fullName: "John" } },
    })

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "John" })
  })

  it("ToolName.FillForm - should merge new fields into the existing session result", async () => {
    const { connectScope, agent, agentSettings, session } = await createFillFormContextWithSession({
      fullName: "Lara Croft",
    })

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.FillForm,
      toolInput: { formFields: { city: "Lyon" } },
    })

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "Lara Croft", city: "Lyon" })
  })

  it("ToolName.FillForm - an unknown value never erases a field filled on an earlier turn", async () => {
    // Small models re-send the whole form with "null" (or null) for the
    // fields they do not know. Those must be dropped before the merge, or
    // they would wipe answers collected earlier.
    const { connectScope, agent, agentSettings, session } = await createFillFormContextWithSession({
      fullName: "Lara Croft",
      city: "Lyon",
    })

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.FillForm,
      toolInput: { formFields: { fullName: "null", city: null } },
    })

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.result).toEqual({ fullName: "Lara Croft", city: "Lyon" })
  })

  it("ToolName.FillForm - should works - getFormState", async () => {
    const { connectScope, agent, agentSettings, session } = await createFillFormContextWithSession({
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
    expect(agentCalls).toHaveLength(3)
    expect(agentCalls[1]?.prompt).toContain("Lara Croft")
  })

  it("ToolName.FillForm - should not be built when fillFormEnabled is off", async () => {
    const { organization, project, agent, agentSettings, conversationAgentSession } =
      await createOrganizationWithAgent(repositories, {
        agent: { type: "conversation" },
        agentSettings: { fillFormEnabled: false, outputJsonSchema: fillFormOutputJsonSchema },
        withLiveConversationAgentSession: true,
      })
    const toolsService = setup.module.get<ToolsService>(ToolsService)

    const { tools } = await toolsService.buildTools({
      agentSessionScope: {
        agent,
        agentSettings,
        session: conversationAgentSession as ConversationAgentSession,
        connectScope: { organizationId: organization.id, projectId: project.id },
      },
      onExecute: () => undefined,
      getProviderForModel: jest.fn().mockReturnValue({} as LLMProvider),
      buildLLMConfig: jest.fn().mockReturnValue({} as LLMConfig),
    })

    // Other conversation tools are still built; only fillForm is gated off.
    expect(tools?.[ToolName.LookupKnowledgeBase]).toBeDefined()
    expect(tools?.[ToolName.FillForm]).toBeUndefined()
  })

  it("ToolName.FillForm - should not be built for public proxy sessions", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "conversation" },
        agentSettings: { fillFormEnabled: true, outputJsonSchema: fillFormOutputJsonSchema },
      },
    )
    const toolsService = setup.module.get<ToolsService>(ToolsService)
    // Mirrors PublicStreamingSessionProxy: no persisted row, so no `result`
    // column to accumulate form state into.
    const publicSessionProxy = {
      id: v4(),
      traceId: v4(),
      organizationId: organization.id,
      messages: [],
    }

    const { tools } = await toolsService.buildTools({
      agentSessionScope: {
        agent,
        agentSettings,
        session: publicSessionProxy,
        connectScope: { organizationId: organization.id, projectId: project.id },
      },
      onExecute: () => undefined,
      getProviderForModel: jest.fn().mockReturnValue({} as LLMProvider),
      buildLLMConfig: jest.fn().mockReturnValue({} as LLMConfig),
    })

    expect(tools?.[ToolName.LookupKnowledgeBase]).toBeDefined()
    expect(tools?.[ToolName.FillForm]).toBeUndefined()
  })

  it("ToolName.LookupKnowledgeBase - should works", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([])

    const { agentCalls } = await runWithToolCall({
      agent,
      agentSettings: ragAgentSettings,
      session,
      connectScope,
      toolName: ToolName.LookupKnowledgeBase,
      toolInput: { query: "What is Bayes?" },
    })

    expect(mockDocumentChunkRetrievalService.retrieveTopChunks).toHaveBeenCalledWith(
      expect.objectContaining({ query: "What is Bayes?", topK: DEFAULT_TOP_K }),
    )
    expect(agentCalls).toHaveLength(3)
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
    expect(agentCalls).toHaveLength(3)
    expect(agentCalls[1]?.prompt).toContain("resource-1")
    // The conversation context reaches the MCP transport as plumbing, with no
    // model involvement: a server can attribute the call and answer in the
    // agent's language.
    expect(mockMcpClientService.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://mcp.test",
        context: expect.objectContaining({
          agentId: agent.id,
          sessionId: session.id,
          locale: agentSettings.locale,
        }),
      }),
    )
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
    expect(agentCalls).toHaveLength(3)
    expect(agentCalls[1]?.prompt).toContain("smart answer")
  })

  it("MCP App - reads the declared ui:// resource and persists the pointer without HTML", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const resourceUri = "ui://patient-summary/mcp-app.html"
    const html = "<html><body>Patient summary</body></html>"
    const toolResult = {
      content: [{ type: "text" as const, text: "ok" }],
      structuredContent: { title: "Ada Lovelace", summary: "Mathematician" },
    }
    const readResource = jest.fn().mockResolvedValue({
      contents: [{ uri: resourceUri, mimeType: "text/html;profile=mcp-app", text: html }],
    })
    const getPatientExecute = jest.fn().mockResolvedValue(toolResult)
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([
      { id: "mcp-server-1", url: "http://mcp.test" },
    ])
    mockMcpClientService.connect.mockResolvedValue({
      tools: {
        get_patient: Object.assign(
          tool({
            description: "Get a patient",
            inputSchema: z.object({ patientId: z.string() }),
            execute: getPatientExecute,
          }),
          { _meta: { ui: { resourceUri } } },
        ),
      },
      close: jest.fn(),
      readResource,
    })

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: "get_patient",
      toolInput: { patientId: "p-1" },
    })

    expect(readResource).toHaveBeenCalledWith(resourceUri)
    const assistantMessage = await repositories.agentMessageRepository.findOne({
      where: { sessionId: session.id, role: "assistant" },
    })
    const mcpAppCall = assistantMessage?.toolCalls?.find(
      (toolCall) => toolCall.name === "get_patient",
    )
    expect(mcpAppCall?.mcpApp).toEqual({ mcpServerId: "mcp-server-1", resourceUri })
    expect(mcpAppCall?.mcpApp).not.toHaveProperty("html")
    expect(mcpAppCall?.result).toEqual(toolResult)
  })

  it("MCP App - does not read an undeclared resource URI", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const readResource = jest.fn()
    const searchExecute = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      _meta: { ui: { resourceUri: "ui://undeclared/app.html" } },
    })
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([
      { id: "mcp-server-1", url: "http://mcp.test" },
    ])
    mockMcpClientService.connect.mockResolvedValue({
      tools: {
        search_resources: tool({
          description: "Search",
          inputSchema: z.object({ query: z.string() }),
          execute: searchExecute,
        }),
      },
      close: jest.fn(),
      readResource,
    })

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: ToolName.McpSearchResources,
      toolInput: { query: "insurance" },
    })

    expect(readResource).not.toHaveBeenCalled()
  })

  it("MCP App - falls back to a normal tool call when the resource MIME type is wrong", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()
    const resourceUri = "ui://patient-summary/mcp-app.html"
    const readResource = jest.fn().mockResolvedValue({
      contents: [{ uri: resourceUri, mimeType: "text/plain", text: "nope" }],
    })
    mockMcpServersService.getEnabledServersForAgent.mockResolvedValue([
      { id: "mcp-server-1", url: "http://mcp.test" },
    ])
    mockMcpClientService.connect.mockResolvedValue({
      tools: {
        get_patient: Object.assign(
          tool({
            description: "Get a patient",
            inputSchema: z.object({ patientId: z.string() }),
            execute: jest.fn().mockResolvedValue({
              content: [{ type: "text", text: "ok" }],
              structuredContent: { title: "Ada" },
            }),
          }),
          { _meta: { ui: { resourceUri } } },
        ),
      },
      close: jest.fn(),
      readResource,
    })

    await runWithToolCall({
      agent,
      agentSettings,
      session,
      connectScope,
      toolName: "get_patient",
      toolInput: { patientId: "p-1" },
    })

    const assistantMessage = await repositories.agentMessageRepository.findOne({
      where: { sessionId: session.id, role: "assistant" },
    })
    const mcpAppCall = assistantMessage?.toolCalls?.find(
      (toolCall) => toolCall.name === "get_patient",
    )
    expect(mcpAppCall?.mcpApp).toBeUndefined()
    expect(mcpAppCall?.name).toBe("get_patient")
  })
})
