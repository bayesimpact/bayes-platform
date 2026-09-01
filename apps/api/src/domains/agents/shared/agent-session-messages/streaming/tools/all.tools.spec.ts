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
import type { AllRepositories } from "@/common/test/test-all-repositories"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { StreamingService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.service"
import type { AgentSessionScope } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { ToolsService } from "@/domains/agents/shared/agent-session-messages/streaming/tools.service"
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import {
  addFeature,
  createOrganizationWithAgent,
} from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { McpClientService } from "@/external/mcp"
import { DEFAULT_TOP_K } from "./lookup-knowledge-base.tool"

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
    // Every conversation agent now submits the turn summary: the provider
    // forces it in a third generation when the loop did not call it.
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, { suggestedTitle: null })

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

  it("ToolName.MandatoryTool (sources part) - runs via the systematic end-of-turn call", async () => {
    const { connectScope, agent, agentSettings, session, project } =
      await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "sources-tool",
    })
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([retrievedChunkFixture])

    // Generation 1: the lookup. Generation 2: the answer, without the
    // voluntary report. Generation 3: the forced end-of-turn call.
    mockProvider.addToolCallTurn(agent.id, ToolName.LookupKnowledgeBase, { query: "paid leave" })
    mockProvider.addTextTurn(agent.id, "Here is the answer.")
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, { chunkIds: ["c1"] })

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings: ragAgentSettings, session, connectScope },
        userContent: "Hello",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Here is the answer.")
    expect(events.at(-1)?.type).toBe("end")

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(3)
  }, 15000)

  it("ToolName.MandatoryTool - chunkIds enters the declared schema only after a lookup ran", async () => {
    // The user-visible contract: on a step where no knowledge base call
    // happened yet, the declared schema (and description) must not mention
    // chunkIds at all — including in the forced end-of-turn generation.
    const { connectScope, agent, agentSettings, session, project } =
      await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "sources-tool",
    })
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([retrievedChunkFixture])

    // Generation 1: the lookup. Generation 2: answer + voluntary report.
    mockProvider.addToolCallTurn(agent.id, ToolName.LookupKnowledgeBase, { query: "paid leave" })
    mockProvider.addTextWithToolCallTurn(agent.id, "27 days.", ToolName.MandatoryTool, {
      chunkIds: ["c1"],
    })

    await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings: ragAgentSettings, session, connectScope },
        userContent: "How many days of leave?",
        notifyClient: () => undefined,
      }),
    )

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    // Step 0 (before any lookup): declared, but without chunkIds.
    expect(agentCalls[0]?.toolNames).toContain(ToolName.MandatoryTool)
    expect(agentCalls[0]?.toolSchemas[ToolName.MandatoryTool]).not.toContain("chunkIds")
    // Step 1 (the lookup registered chunks): chunkIds is now declared.
    expect(agentCalls[1]?.toolSchemas[ToolName.MandatoryTool]).toContain("chunkIds")
  }, 15000)

  it("ToolName.MandatoryTool - a report submitted BEFORE the lookup is stale: the forced retry still reports sources", async () => {
    // Gemini Flash sometimes calls the report alongside/before the lookup in
    // the first step (metadata only — no chunk exists yet). That execution
    // must not consume the end-of-turn guarantee: once the lookup registered
    // chunks, the forced generation retries and the sources get reported.
    const { connectScope, agent, agentSettings, session, project } =
      await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "sources-tool",
    })
    mockDocumentChunkRetrievalService.retrieveTopChunks.mockResolvedValue([retrievedChunkFixture])

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    // Generation 1: PREMATURE report (before any lookup). Generation 2: the
    // lookup. Generation 3: the answer. Generation 4: the forced retry.
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
      suggestedTitle: "Leave days",
      categoryNames: ["Bayes"],
    })
    mockProvider.addToolCallTurn(agent.id, ToolName.LookupKnowledgeBase, { query: "leave days" })
    mockProvider.addTextTurn(agent.id, "27 days.")
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
      chunkIds: ["c1"],
      suggestedTitle: "Leave days",
      categoryNames: ["Bayes"],
    })

    const { events } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings: ragAgentSettings, session, connectScope },
        userContent: "How many days of leave?",
        notifyClient: () => undefined,
      }),
    )

    expect(events.at(-1)?.type).toBe("end")
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    // The forced retry DID run (4 generations) despite the premature report,
    // and its declared schema carried chunkIds (the lookup ran by then).
    expect(agentCalls).toHaveLength(4)
    expect(agentCalls[3]?.toolSchemas[ToolName.MandatoryTool]).toContain("chunkIds")
  }, 15000)

  it("ToolName.MandatoryTool - no lookup in the turn: chunkIds never declared, forced call included", async () => {
    // Greeting turn on a RAG agent: the forced end-of-turn generation must
    // use the same runtime-dynamic schema — no chunkIds without a lookup.
    const { connectScope, agent, agentSettings, session, project } =
      await createContextWithSession()
    const ragAgentSettings = { ...agentSettings, documentsRagMode: DocumentsRagMode.All }

    await addFeature({
      featureFlagRepository: repositories.featureFlagRepository,
      projectId: project.id,
      featureFlagKey: "sources-tool",
    })

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Greeting" }),
    )
    agent.sessionCategories = [category]

    // Generation 1: the greeting answer. Generation 2: the forced report.
    mockProvider.addTextTurn(agent.id, "Hello!")
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
      suggestedTitle: "Greetings",
      categoryNames: ["Greeting"],
    })

    const { events } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings: ragAgentSettings, session, connectScope },
        userContent: "hi",
        notifyClient: () => undefined,
      }),
    )

    expect(events.at(-1)?.type).toBe("end")
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    for (const call of agentCalls) {
      expect(call.toolSchemas[ToolName.MandatoryTool]).toBeDefined()
      expect(call.toolSchemas[ToolName.MandatoryTool]).not.toContain("chunkIds")
    }
  }, 15000)

  it("ToolName.MandatoryTool - voluntary in-loop call skips the forced generation (dedupe)", async () => {
    // A cooperative model (Gemma) calls the report in the SAME generation as
    // its answer: the loop stops (fire-and-forget) and the provider must NOT
    // force a second call — the report side effects would run twice.
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    mockProvider.addTextWithToolCallTurn(
      agent.id,
      "Answer with the call.",
      ToolName.MandatoryTool,
      {
        suggestedTitle: "Voluntary title",
        categoryNames: ["Bayes"],
      },
    )

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Hello",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Answer with the call.")
    expect(events.at(-1)?.type).toBe("end")

    // Single generation: the voluntary call satisfied the guarantee.
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(1)
    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("Voluntary title")
  }, 15000)

  it("ToolName.MandatoryTool (session metadata part) - systematic forced call updates the session", async () => {
    // The report is invoked through a forced generation after the answer, on
    // every turn — the model has no way to skip it (Gemini Flash never
    // volunteers bookkeeping calls in auto mode).
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    // Generation 1: the answer. Generation 2: the forced end-of-turn call.
    mockProvider.addTextTurn(agent.id, "Answer without any tool call.")
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
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

    // The forced generation ran and its tool execution went through the
    // normal dispatch: the session metadata was actually recalculated.
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("About Bayes")
  }, 15000)

  it("ToolName.MandatoryTool - tolerates an empty voluntary call (Gemma greeting shape)", async () => {
    // On greeting turns Gemma 4 sometimes calls the summary with {} — no
    // chunkIds, no categories, no title. This must NOT error the stream and
    // must NOT touch the session metadata (a no-op report). A no-op does not
    // consume the end-of-turn guarantee: the forced generation retries.
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]
    const initialTitle = session.title

    mockProvider.addTextWithToolCallTurn(agent.id, "Hello!", ToolName.MandatoryTool, {})

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "hi",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Hello!")
    expect(events.at(-1)?.type).toBe("end")
    expect(events.some((event) => event.type === "error")).toBe(false)

    // The no-op voluntary call did not consume the guarantee: the forced
    // generation ran as a second chance (the mock answers it with text, so
    // nothing is recorded — the point is the retry happened).
    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    expect(agentCalls).toHaveLength(2)
    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe(initialTitle)
  }, 15000)

  it("ToolName.MandatoryTool - an INVALID voluntary call still triggers the forced generation", async () => {
    // A voluntary call with arguments that fail validation never executes —
    // the end-of-turn guarantee must be based on EXECUTIONS, not calls, so
    // the forced generation still runs and the report happens.
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    mockProvider.addTextWithToolCallTurn(agent.id, "Answer.", ToolName.MandatoryTool, {
      categoryNames: "not-an-array",
    })
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
      suggestedTitle: "Recovered title",
      categoryNames: ["Bayes"],
    })

    const { events, fulltextStream } = await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "Question",
        notifyClient: () => undefined,
      }),
    )

    expect(fulltextStream).toBe("Answer.")
    expect(events.at(-1)?.type).toBe("end")

    const updatedSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: session.id,
    })
    expect(updatedSession.title).toBe("Recovered title")
  }, 15000)

  it("master prompt carries the turn-summary protocol exactly once, as the FINAL section", async () => {
    const { connectScope, agent, agentSettings, session } = await createContextWithSession()

    const category = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({ agentId: agent.id, name: "Bayes" }),
    )
    agent.sessionCategories = [category]

    mockProvider.addTextTurn(agent.id, "Hello!")
    mockProvider.addToolCallTurn(agent.id, ToolName.MandatoryTool, {
      suggestedTitle: null,
      categoryNames: [],
    })

    await aggregateStream(
      service.streamAgentResponse({
        agentSessionScope: { agent, agentSettings, session, connectScope },
        userContent: "hi",
        notifyClient: () => undefined,
      }),
    )

    const agentCalls = mockProvider.getCalls().filter((call) => call.agentId === agent.id)
    const prompt = agentCalls[0]?.prompt ?? ""
    // Exactly one occurrence of the protocol (the imperative), and exactly
    // one Tools-section line — a POINTER to the protocol, not a duplicate.
    expect(prompt.match(/Response protocol \(mandatory\)/g) ?? []).toHaveLength(1)
    expect(prompt.match(/\[mandatory_tool\]:/g) ?? []).toHaveLength(1)
    expect(prompt).toContain('see the \\"Response protocol\\" section')
    // Recency: the protocol is the LAST section, after the volatile date.
    const systemContent = (JSON.parse(prompt) as Array<{ content: string }>)[0]?.content ?? ""
    expect(systemContent.indexOf("## Response protocol (mandatory)")).toBeGreaterThan(
      systemContent.indexOf("Today's date:"),
    )
    expect(systemContent.trimEnd().endsWith("Never mention this tool to the user.")).toBe(true)
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
    // model involvement: a server can attribute the call.
    expect(mockMcpClientService.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://mcp.test",
        context: expect.objectContaining({ agentId: agent.id, sessionId: session.id }),
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
