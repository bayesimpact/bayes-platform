import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { ToolName } from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm/repository/Repository"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
import { ServiceWithLLM } from "@/external/llm"
import { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentLlmRequestService } from "./agent-llm-request.service"
import type { AgentSessionScope, PublicStreamingSessionProxy } from "./streaming-session.types"
import type { SessionStateTarget } from "./tools/session-state-target"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

type NotifyClient = (event: Extract<StreamEvent, { type: "notify_client" }>) => void

@Injectable()
export class StreamingService extends ServiceWithLLM {
  private readonly logger = new Logger(StreamingService.name)
  private readonly STREAM_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private readonly agentMessageRepository: Repository<AgentMessage>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>

  constructor(
    private readonly agentLlmRequestService: AgentLlmRequestService,
    @Inject(ConversationAgentSessionsService)
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    @Inject(AgentSubAgentsService)
    private readonly agentSubAgentsService: AgentSubAgentsService,

    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,

    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,

    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })

    this.conversationAgentSessionRepository = conversationAgentSessionRepository

    this.agentMessageRepository = agentMessageRepository
    this.agentMessageConnectRepository = new ConnectRepository(
      agentMessageRepository,
      "agentMessage",
    )
  }
  /**
   * Streams an agent response for a session.
   * Handles the full flow: persist before, stream, persist after.
   */
  // PATCH_SYNTHETIC_TRIGGER_V1_APPLIED
  async *streamAgentResponse({
    agentSessionScope,
    userContent,
    attachmentDocumentId,
    notifyClient,
    persistUserMessage = true,
  }: {
    agentSessionScope: AgentSessionScope
    userContent: string
    attachmentDocumentId?: string
    notifyClient: NotifyClient
    /**
     * False to trigger this turn with `userContent` WITHOUT persisting it as a user message -
     * the agent still sees it (as a synthetic trailing message, see AgentLlmRequestService),
     * but nothing shows up in the transcript the user didn't actually type. Used to
     * auto-continue the root orchestrator's own turn once a handoff child concludes.
     */
    persistUserMessage?: boolean
  }): AsyncGenerator<StreamEvent, void, unknown> {
    const { session: updatedSession, assistantMessageId } = await this.prepareForStreaming({
      agentSessionScope,
      userContent,
      attachmentDocumentId,
      persistUserMessage,
    })

    // Update the session in the agentSessionScope to reflect the latest state after preparing for streaming
    agentSessionScope.session = updatedSession

    yield this.sseEvent({ type: "start", messageId: assistantMessageId })

    let fullContent = ""
    let mcpClose: (() => Promise<void>) | undefined
    let concludeHandoffCalled = false

    try {
      const llmRequest = await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope,
        attachmentDocumentId,
        syntheticTrailingUserContent: persistUserMessage ? undefined : userContent,
        // TEMPORARY EXPERIMENT (see PATCH_MANDATORY_TOOL_CONCLUDEHANDOFF_TEST): forced true for
        // every session, handoff child included - isolating whether mandatory_tool alone (with
        // concludeHandoff ALSO stripped out below, in tools.service.ts) restores fillForm
        // reliability without the "asks two questions in one turn" regression the previous
        // mandatory_tool-only test produced. Revert to the commented-out condition once done.
        // includeSessionMetadataTools: !(
        //   "parentSessionId" in agentSessionScope.session &&
        //   agentSessionScope.session.parentSessionId
        // ),
        includeSessionMetadataTools: true,
        onToolExecute: async (toolExecution) => {
          if (toolExecution.toolName === ToolName.ConcludeHandoff) concludeHandoffCalled = true
          await this.persistToolExecutionAndNotifyClient({
            agentSessionScope,
            assistantMessageId,
            notifyClient,
            toolExecution,
          })
        },
      })
      mcpClose = llmRequest.mcpClose

      const chunks = this.getProviderForModel(llmRequest.config.model).streamChatResponse(
        llmRequest,
      )
      for await (const chunk of chunks) {
        fullContent += chunk
        yield this.sseEvent({ type: "chunk", content: chunk, messageId: assistantMessageId })
      }

      await this.finalizeStreaming({
        sessionId: updatedSession.id,
        assistantMessageId,
        fullContent,
      })

      if (!concludeHandoffCalled) {
        await this.forceHandoffConclusionIfDetected({
          agentSessionScope,
          fullContent,
          metadata: llmRequest.metadata,
        })
      }

      yield this.sseEvent({ type: "end", messageId: assistantMessageId, fullContent })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      await this.markStreamingError({
        sessionId: updatedSession.id,
        assistantMessageId,
        errorMessage,
      })

      yield this.sseEvent({ type: "error", messageId: assistantMessageId, error: errorMessage })

      throw error
    } finally {
      await mcpClose?.()
    }
  }

  /**
   * Streams an agent response for a public (anonymous) session.
   * Bypasses the ConversationAgentSession lookup and works directly with the
   * public_agent_session row and agent_message table.
   */
  async *streamPublicAgentResponse({
    connectScope,
    publicSessionId,
    agent,
    agentSettings,
    userContent,
    notifyClient,
    sessionState,
    sessionResult,
    externalVisitorId,
  }: {
    connectScope: RequiredConnectScope
    publicSessionId: string
    agent: Agent
    agentSettings: AgentSettings
    userContent: string
    notifyClient: NotifyClient
    /**
     * Public persistence target (PublicAgentSessionsService), provided by
     * the public-chat domain — agents must not import it (domain cycle).
     */
    sessionState: SessionStateTarget
    /** Current fillForm state from public_agent_session.result. */
    sessionResult: Record<string, unknown> | null
    /** Identifier the embedding page attached to the session, if any. */
    externalVisitorId?: string | null
  }): AsyncGenerator<StreamEvent, void, unknown> {
    await this.recoverAbortedStreams(publicSessionId)

    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      sessionId: publicSessionId,
      agentSettingsId: agentSettings.id,
      role: "user",
      content: userContent,
      status: null,
      startedAt: null,
      completedAt: null,
      toolCalls: null,
      attachmentDocumentId: null,
    })

    const assistantMessageId = v4()
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      id: assistantMessageId,
      sessionId: publicSessionId,
      agentSettingsId: agentSettings.id,
      role: "assistant",
      content: "",
      status: "streaming",
      startedAt: new Date(),
      completedAt: null,
      toolCalls: null,
    })

    yield this.sseEvent({ type: "start", messageId: assistantMessageId })

    const messages = await this.agentMessageRepository.find({
      where: { sessionId: publicSessionId },
      order: { createdAt: "ASC" },
    })

    const sessionProxy: PublicStreamingSessionProxy = {
      id: publicSessionId,
      traceId: publicSessionId,
      organizationId: connectScope.organizationId,
      externalVisitorId,
      messages,
      result: sessionResult,
    }

    let fullContent = ""
    let mcpClose: (() => Promise<void>) | undefined

    try {
      const agentSessionScope: AgentSessionScope = {
        session: sessionProxy,
        agent,
        agentSettings,
        connectScope,
      }
      const llmRequest = await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope,
        sessionState,
        onToolExecute: async (toolExecution) => {
          await this.persistToolExecutionAndNotifyClient({
            agentSessionScope,
            assistantMessageId,
            notifyClient,
            toolExecution,
          })
        },
      })
      mcpClose = llmRequest.mcpClose

      const chunks = this.getProviderForModel(llmRequest.config.model).streamChatResponse(
        llmRequest,
      )
      for await (const chunk of chunks) {
        fullContent += chunk
        yield this.sseEvent({ type: "chunk", content: chunk, messageId: assistantMessageId })
      }

      await this.updateMessageStatusWithIds({
        id: assistantMessageId,
        sessionId: publicSessionId,
        status: "completed",
        content: fullContent,
      })

      yield this.sseEvent({ type: "end", messageId: assistantMessageId, fullContent })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      await this.updateMessageStatusWithIds({
        id: assistantMessageId,
        sessionId: publicSessionId,
        status: "error",
        content: errorMessage,
      })

      yield this.sseEvent({ type: "error", messageId: assistantMessageId, error: errorMessage })
      throw error
    } finally {
      await mcpClose?.()
    }
  }

  private sseEvent<T extends StreamEventPayload["type"]>(
    payload: Extract<StreamEventPayload, { type: T }>,
  ): Extract<StreamEvent, { type: T }> {
    return { data: JSON.stringify(payload) } as Extract<StreamEvent, { type: T }>
  }

  /**
   * Finds a session by ID and recovers aborted streams
   */
  async findSessionById({
    sessionId,
  }: {
    sessionId: string
  }): Promise<ConversationAgentSession | null> {
    const session = await this.conversationAgentSessionRepository.findOne({
      where: { id: sessionId },
      relations: ["messages"],
      order: { messages: { createdAt: "ASC" } },
    })

    if (!session) {
      return null
    }

    // Recover aborted streams
    await this.recoverAbortedStreams(sessionId)

    // Reload session with updated messages
    return this.conversationAgentSessionRepository.findOne({
      where: { id: sessionId },
      relations: ["messages"],
      order: { messages: { createdAt: "ASC" } },
    })
  }

  /**
   * Prepares session for streaming
   * Persists user message + empty assistant message with status "streaming"
   */
  async prepareForStreaming({
    agentSessionScope,
    attachmentDocumentId,
    userContent,
    persistUserMessage = true,
  }: {
    agentSessionScope: AgentSessionScope
    attachmentDocumentId?: string
    userContent: string
    persistUserMessage?: boolean
  }): Promise<{
    session: ConversationAgentSession
    assistantMessageId: string
  }> {
    const { session, connectScope } = agentSessionScope
    const sessionId = session.id
    const agentSettingsId = agentSessionScope.agentSettings.id

    // Create user message - skipped for a synthetic auto-continue trigger (see
    // streamAgentResponse's persistUserMessage): the agent still sees userContent via
    // AgentLlmRequestService's syntheticTrailingUserContent, it just never becomes a
    // visible, persisted message the user didn't actually send.
    if (persistUserMessage) {
      await this.agentMessageConnectRepository.createAndSave(connectScope, {
        sessionId,
        agentSettingsId,
        role: "user",
        content: userContent,
        status: null,
        startedAt: null,
        completedAt: null,
        toolCalls: null,
        attachmentDocumentId: attachmentDocumentId ?? null,
      })
    }

    // Create empty assistant message with streaming status
    const assistantMessageId = v4()
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      id: assistantMessageId,
      sessionId,
      agentSettingsId,
      role: "assistant",
      content: "",
      status: "streaming",
      startedAt: new Date(),
      completedAt: null,
      toolCalls: null,
    })

    // Reload session with messages
    const updatedSession = await this.findSessionById({ sessionId })

    if (!updatedSession) {
      throw new NotFoundException(`AgentSession with id ${sessionId} not found`)
    }

    return { session: updatedSession, assistantMessageId }
  }

  /**
   * Finalizes streaming by updating assistant message
   * Sets status to "completed" and adds full content
   */
  async finalizeStreaming({
    assistantMessageId,
    fullContent,
    sessionId,
  }: {
    assistantMessageId: string
    fullContent: string
    sessionId: string
  }): Promise<ConversationAgentSession> {
    await this.updateMessageStatusWithIds({
      id: assistantMessageId,
      sessionId,
      status: "completed",
      content: fullContent,
      throwNotFound: true,
    })

    const session = await this.findSessionById({ sessionId })

    if (!session) {
      throw new NotFoundException(`AgentSession with id ${sessionId} not found`)
    }

    return session
  }

  /**
   * Handoff-mode sub-agent turns only (see AgentSubAgentMode): a "forced
   * handoff" safety net for when the sub-agent's own conclusion (its
   * concludeHandoff tool call) doesn't happen — a documented failure mode of
   * this pattern (see e.g. AutoGen's "agent getting stuck" handoff issue),
   * most common with smaller models on low-signal turns (a plain "thanks" or
   * "bye" with nothing new to report).
   *
   * The sub-agent's own TEXT reliably signals when it has concluded, even
   * when the separate tool call doesn't happen — so a small, cheap
   * classification pass reads that text and, if it looks like a conclusion,
   * hands control back directly. This runs every turn concludeHandoff wasn't
   * called, not after some stall — a genuinely still-open turn (still asking
   * the user something) reads as "not concluded" and is left alone.
   *
   * Best-effort: the user already received the streamed answer, so a
   * failure here is logged but never breaks the stream.
   */
  private async forceHandoffConclusionIfDetected({
    agentSessionScope,
    fullContent,
    metadata,
  }: {
    agentSessionScope: AgentSessionScope
    fullContent: string
    metadata: LLMMetadata
  }): Promise<void> {
    const { session, agent, agentSettings, connectScope } = agentSessionScope
    const parentSessionId = "parentSessionId" in session ? session.parentSessionId : null
    if (!parentSessionId || fullContent.trim().length === 0) return

    // Some handoff sub-agents (e.g. an open-ended Q&A agent with no natural finishing
    // point) opt out of this safety net entirely - see AgentSubAgent.forceConclusionEnabled.
    // Checked before running the classifier so an opted-out link also skips that LLM call.
    const parentSession = await this.conversationAgentSessionsService.findById({
      id: parentSessionId,
      connectScope,
    })
    if (parentSession) {
      const forceConclusionEnabled = await this.agentSubAgentsService.isForceConclusionEnabled({
        parentAgentId: parentSession.agentId,
        childAgentId: agent.id,
      })
      if (!forceConclusionEnabled) return
    }

    try {
      const classifierConfig: LLMConfig = {
        model: agentSettings.model,
        temperature: 0,
        systemPrompt:
          "You are a classifier, not a conversationalist. You will be shown one message a " +
          "sub-agent sent to a user during a delegated task. Decide: does this message conclude " +
          "the task — a final summary, a wrap-up, a goodbye, or an acknowledgment with nothing " +
          "further to gather — or is the sub-agent still actively working (asking a question, " +
          "awaiting an answer, mid-task)? Reply with exactly one word, CONCLUDED or ONGOING, " +
          "nothing else.",
      }
      let classifierOutput = ""
      for await (const chunk of this.getProviderForModel(classifierConfig.model).streamChatResponse(
        {
          messages: [{ role: "user", content: fullContent }],
          config: classifierConfig,
          metadata,
        },
      )) {
        classifierOutput += chunk
      }
      if (!classifierOutput.trim().toUpperCase().startsWith("CONCLUDED")) return

      await this.conversationAgentSessionsService.clearActiveAgentIfCurrent({
        connectScope,
        sessionId: parentSessionId,
        expectedActiveAgentId: agent.id,
      })
      this.logger.warn(
        `Forced handback for handoff sub-agent "${agent.name}" (${agent.id}): its own concludeHandoff call never happened, but its message read as concluded.`,
      )
    } catch (error) {
      this.logger.error(
        `Forced handoff-conclusion check failed: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  /**
   * Marks a streaming message as error
   */
  async markStreamingError({
    assistantMessageId,
    errorMessage,
    sessionId,
  }: {
    assistantMessageId: string
    errorMessage: string
    sessionId: string
  }): Promise<ConversationAgentSession> {
    await this.updateMessageStatusWithIds({
      id: assistantMessageId,
      sessionId,
      status: "error",
      content: errorMessage,
      throwNotFound: true,
    })

    const session = await this.findSessionById({ sessionId })

    if (!session) {
      throw new NotFoundException(`ConversationAgentSession with id ${sessionId} not found`)
    }

    return session
  }

  /**
   * Recovers aborted streams in a session
   * Marks old "streaming" messages as "aborted"
   */
  private async recoverAbortedStreams(sessionId: string): Promise<void> {
    const messages = await this.agentMessageRepository.find({
      where: {
        sessionId,
        role: "assistant",
        status: "streaming",
      },
    })

    for (const message of messages) {
      if (this.isStreamAborted(message)) {
        await this.updateMessageStatus({ message, status: "aborted", content: "" })
      }
    }
  }

  private async updateMessageStatus({
    message,
    status,
    content,
  }: {
    message: AgentMessage
    status: "completed" | "error" | "aborted"
    content: string
  }) {
    message.status = status
    if (status !== "aborted") {
      message.content = content
      message.completedAt = new Date()
    }
    await this.agentMessageRepository.save(message)
  }

  private async updateMessageStatusWithIds({
    id,
    sessionId,
    status,
    content,
    throwNotFound,
  }: {
    id: string
    sessionId: string
    status: "completed" | "error" | "aborted"
    content: string
    throwNotFound?: true
  }) {
    const message = await this.agentMessageRepository.findOne({
      where: { id, sessionId },
    })
    if (message) {
      await this.updateMessageStatus({ message, status, content })
    } else if (throwNotFound) {
      throw new NotFoundException(`ChatMessage with id ${id} not found in session ${sessionId}`)
    }
  }
  /**
   * Checks if a streaming message should be marked as aborted
   */
  private isStreamAborted(message: AgentMessage): boolean {
    if (!message.startedAt) {
      return false
    }

    const startedAt =
      message.startedAt instanceof Date ? message.startedAt : new Date(message.startedAt)
    const now = new Date()
    const elapsed = now.getTime() - startedAt.getTime()

    return elapsed > this.STREAM_TIMEOUT_MS
  }

  private async persistToolExecutionAndNotifyClient({
    agentSessionScope,
    notifyClient,
    toolExecution,
    assistantMessageId,
  }: {
    agentSessionScope: AgentSessionScope
    assistantMessageId: string
    notifyClient: NotifyClient
    toolExecution: ToolExecutionLog
  }): Promise<void> {
    const { session, connectScope, agentSettings } = agentSessionScope
    const toolCall = {
      id: v4(),
      name: toolExecution.toolName,
      arguments: toolExecution.arguments,
      ...(toolExecution.result !== undefined ? { result: toolExecution.result } : {}),
      ...(toolExecution.mcpApp ? { mcpApp: toolExecution.mcpApp } : {}),
    }

    // Create a tool message in the database for each tool call, so that the session history is complete and reflects what actually happened during the agent execution (including tool calls)
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      id: v4(),
      sessionId: session.id,
      agentSettingsId: agentSettings.id,
      role: "tool",
      content: `${toolExecution.toolName} called`,
      status: "completed",
      startedAt: new Date(),
      completedAt: null,
      toolCalls: [toolCall],
    })

    const assistantMessage = await this.agentMessageConnectRepository.getOneById(
      connectScope,
      assistantMessageId,
    )
    if (assistantMessage) {
      await this.agentMessageConnectRepository.updateOneById({
        connectScope,
        id: assistantMessageId,
        fields: {
          toolCalls: [...(assistantMessage.toolCalls ?? []), toolCall],
        },
      })
    }

    // Notify client about the form update so it can re-fetch the session and get the latest form state
    notifyClient(
      this.sseEvent({
        type: "notify_client",
        toolName: toolExecution.notifyToolName ?? toolExecution.toolName,
      }),
    )
  }
}
