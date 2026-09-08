import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm/repository/Repository"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { LlmServiceBase } from "@/external/llm"
import { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { recoverAbortedStreams, throttleHeartbeat } from "../stream-recovery"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentLlmRequestService } from "./agent-llm-request.service"
import type { AgentSessionScope, PublicStreamingSessionProxy } from "./streaming-session.types"
import type { SessionStateTarget } from "./tools/session-state-target"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

type NotifyClient = (event: Extract<StreamEvent, { type: "notify_client" }>) => void

@Injectable()
export class StreamingLlmService extends LlmServiceBase {
  private readonly logger = new Logger(StreamingLlmService.name)
  private readonly agentMessageRepository: Repository<AgentMessage>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>

  constructor(
    private readonly agentLlmRequestService: AgentLlmRequestService,
    private readonly attachmentDocumentsService: AgentMessageAttachmentDocumentsService,

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
  async *streamAgentResponse({
    agentSessionScope,
    userContent,
    attachmentDocumentId,
    notifyClient,
  }: {
    agentSessionScope: AgentSessionScope
    userContent: string
    attachmentDocumentId?: string
    notifyClient: NotifyClient
  }): AsyncGenerator<StreamEvent, void, unknown> {
    const {
      session: updatedSession,
      assistantMessageId,
      attachmentDocumentId: turnAttachmentDocumentId,
    } = await this.prepareForStreaming({
      agentSessionScope,
      userContent,
      attachmentDocumentId,
    })

    // Update the session in the agentSessionScope to reflect the latest state after preparing for streaming
    agentSessionScope.session = updatedSession

    yield this.sseEvent({ type: "start", messageId: assistantMessageId })

    let fullContent = ""
    let mcpClose: (() => Promise<void>) | undefined
    const onProgress = this.progressHeartbeat({
      connectScope: agentSessionScope.connectScope,
      assistantMessageId,
    })

    try {
      const llmRequest = await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope,
        attachmentDocumentId: turnAttachmentDocumentId,
        onToolExecute: async (toolExecution) => {
          await this.persistToolExecutionAndNotifyClient({
            agentSessionScope,
            assistantMessageId,
            notifyClient,
            toolExecution,
          })
        },
        getProviderForModel: this.getProviderForModel,
        buildLLMConfig: this.buildLLMConfig,
      })
      mcpClose = llmRequest.mcpClose

      const chunks = this.getProviderForModel(llmRequest.config.model).streamChatResponse(
        llmRequest,
      )
      for await (const chunk of chunks) {
        fullContent += chunk
        onProgress()
        yield this.sseEvent({ type: "chunk", content: chunk, messageId: assistantMessageId })
      }

      await this.finalizeStreaming({
        sessionId: updatedSession.id,
        assistantMessageId,
        fullContent,
      })

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
    await recoverAbortedStreams({
      agentMessageConnectRepository: this.agentMessageConnectRepository,
      connectScope,
      sessionId: publicSessionId,
    })

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
    const onProgress = this.progressHeartbeat({ connectScope, assistantMessageId })

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
        getProviderForModel: this.getProviderForModel,
        buildLLMConfig: this.buildLLMConfig,
      })
      mcpClose = llmRequest.mcpClose

      const chunks = this.getProviderForModel(llmRequest.config.model).streamChatResponse(
        llmRequest,
      )
      for await (const chunk of chunks) {
        fullContent += chunk
        onProgress()
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

  /**
   * Touches the streaming message as the answer progresses, so a long turn is not taken for an
   * orphaned one by the recovery sweep (see `isStreamStale`), while a hung one is. Tool runs
   * write the row on their own. Only a row still streaming is touched: a late write must not
   * disturb a settled message. The write is not awaited, so it never slows the stream down.
   */
  private progressHeartbeat({
    connectScope,
    assistantMessageId,
  }: {
    connectScope: RequiredConnectScope
    assistantMessageId: string
  }): () => void {
    return throttleHeartbeat(() => {
      this.agentMessageConnectRepository
        .updateManyBy({
          connectScope,
          where: { id: assistantMessageId, status: "streaming" },
          fields: { updatedAt: new Date() },
        })
        .catch((error: unknown) => {
          this.logger.warn(`Heartbeat failed for message ${assistantMessageId}`, error)
        })
    })
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
    await recoverAbortedStreams({
      agentMessageConnectRepository: this.agentMessageConnectRepository,
      connectScope: { organizationId: session.organizationId, projectId: session.projectId },
      sessionId,
    })

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
   *
   * Returns the attachment the turn actually carries: the given one, or a copy of it when it
   * already belongs to an earlier message (see {@link attachmentForTurn}).
   */
  async prepareForStreaming({
    agentSessionScope,
    attachmentDocumentId,
    userContent,
  }: {
    agentSessionScope: AgentSessionScope
    attachmentDocumentId?: string
    userContent: string
  }): Promise<{
    session: ConversationAgentSession
    assistantMessageId: string
    attachmentDocumentId?: string
  }> {
    const { session, connectScope } = agentSessionScope
    const sessionId = session.id
    const agentSettingsId = agentSessionScope.agentSettings.id

    const turnAttachmentDocumentId = attachmentDocumentId
      ? await this.attachmentForTurn({ connectScope, sessionId, attachmentDocumentId })
      : undefined

    // Create user message
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      sessionId,
      agentSettingsId,
      role: "user",
      content: userContent,
      status: null,
      startedAt: null,
      completedAt: null,
      toolCalls: null,
      attachmentDocumentId: turnAttachmentDocumentId ?? null,
    })

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

    return {
      session: updatedSession,
      assistantMessageId,
      attachmentDocumentId: turnAttachmentDocumentId,
    }
  }

  /**
   * An attachment row is attached to exactly one message (unique column). Sending an interrupted
   * turn again reuses the attachment the user already uploaded, so when the row is taken by an
   * earlier message of this same conversation the new turn gets a copy of it. An attachment
   * taken by another conversation is not reusable: only the conversation that uploaded a file
   * may attach it again.
   */
  private async attachmentForTurn({
    connectScope,
    sessionId,
    attachmentDocumentId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    attachmentDocumentId: string
  }): Promise<string> {
    const [attachedTo] = await this.agentMessageConnectRepository.find(connectScope, {
      where: { attachmentDocumentId },
      select: { id: true, sessionId: true },
      take: 1,
    })
    if (!attachedTo) return attachmentDocumentId
    if (attachedTo.sessionId !== sessionId) {
      throw new UnprocessableEntityException(
        `Attachment document with ID ${attachmentDocumentId} belongs to another conversation`,
      )
    }

    const copy = await this.attachmentDocumentsService.copyAttachmentDocument({
      connectScope,
      attachmentDocumentId,
    })
    return copy.id
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

  private async updateMessageStatus({
    message,
    status,
    content,
  }: {
    message: AgentMessage
    status: "completed" | "error"
    content: string
  }) {
    message.status = status
    message.content = content
    message.completedAt = new Date()
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
    status: "completed" | "error"
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
