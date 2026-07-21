import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm/repository/Repository"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { ServiceWithLLM } from "@/external/llm"
import { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentLlmRequestService } from "./agent-llm-request.service"
import type { AgentSessionScope, PublicStreamingSessionProxy } from "./streaming-session.types"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

type NotifyClient = (event: Extract<StreamEvent, { type: "notify_client" }>) => void

@Injectable()
export class StreamingService extends ServiceWithLLM {
  private readonly STREAM_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private readonly agentMessageRepository: Repository<AgentMessage>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>
  private readonly formAgentSessionRepository: Repository<FormAgentSession>

  constructor(
    private readonly agentLlmRequestService: AgentLlmRequestService,

    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,

    @InjectRepository(FormAgentSession)
    formAgentSessionRepository: Repository<FormAgentSession>,

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

    this.formAgentSessionRepository = formAgentSessionRepository

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
    const { agent } = agentSessionScope

    const { session: updatedSession, assistantMessageId } = await this.prepareForStreaming({
      agentSessionScope,
      userContent,
      attachmentDocumentId,
      agentType: agent.type,
    })

    // Update the session in the agentSessionScope to reflect the latest state after preparing for streaming
    agentSessionScope.session = updatedSession

    yield this.sseEvent({ type: "start", messageId: assistantMessageId })

    let fullContent = ""
    let mcpClose: (() => Promise<void>) | undefined

    try {
      const llmRequest = await this.agentLlmRequestService.buildLLMRequest({
        agentSessionScope,
        attachmentDocumentId,
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

      await this.finalizeStreaming({
        sessionId: updatedSession.id,
        assistantMessageId,
        fullContent,
        agentType: agent.type,
      })

      yield this.sseEvent({ type: "end", messageId: assistantMessageId, fullContent })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      await this.markStreamingError({
        sessionId: updatedSession.id,
        assistantMessageId,
        errorMessage,
        agentType: agent.type,
      })

      yield this.sseEvent({ type: "error", messageId: assistantMessageId, error: errorMessage })

      throw error
    } finally {
      await mcpClose?.()
    }
  }

  /**
   * Streams an agent response for a public (anonymous) session.
   * Bypasses the ConversationAgentSession / FormAgentSession lookup and works
   * directly with the public_agent_session row and agent_message table.
   */
  async *streamPublicAgentResponse({
    connectScope,
    publicSessionId,
    agent,
    agentSettings,
    userContent,
    notifyClient,
  }: {
    connectScope: RequiredConnectScope
    publicSessionId: string
    agent: Agent
    agentSettings: AgentSettings
    userContent: string
    notifyClient: NotifyClient
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
      messages,
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
    agentType,
  }: {
    sessionId: string
    agentType: Agent["type"]
  }): Promise<ConversationAgentSession | FormAgentSession | null> {
    if (agentType !== "conversation" && agentType !== "form") {
      throw new Error(`Unsupported agent type: ${agentType}`)
    }
    const repository =
      agentType === "conversation"
        ? this.conversationAgentSessionRepository
        : this.formAgentSessionRepository
    const session = await repository.findOne({
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
    return repository.findOne({
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
    agentType,
    attachmentDocumentId,
    userContent,
  }: {
    agentType: Agent["type"]
    agentSessionScope: AgentSessionScope
    attachmentDocumentId?: string
    userContent: string
  }): Promise<{
    session: ConversationAgentSession | FormAgentSession
    assistantMessageId: string
  }> {
    const { session, connectScope } = agentSessionScope
    const sessionId = session.id
    const agentSettingsId = agentSessionScope.agentSettings.id

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
      attachmentDocumentId: attachmentDocumentId ?? null,
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
    const updatedSession = await this.findSessionById({ sessionId, agentType })

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
    agentType,
    assistantMessageId,
    fullContent,
    sessionId,
  }: {
    agentType: Agent["type"]
    assistantMessageId: string
    fullContent: string
    sessionId: string
  }): Promise<ConversationAgentSession | FormAgentSession> {
    await this.updateMessageStatusWithIds({
      id: assistantMessageId,
      sessionId,
      status: "completed",
      content: fullContent,
      throwNotFound: true,
    })

    const session = await this.findSessionById({ sessionId, agentType })

    if (!session) {
      throw new NotFoundException(`AgentSession with id ${sessionId} not found`)
    }

    return session
  }

  /**
   * Marks a streaming message as error
   */
  async markStreamingError({
    agentType,
    assistantMessageId,
    errorMessage,
    sessionId,
  }: {
    agentType: Agent["type"]
    assistantMessageId: string
    errorMessage: string
    sessionId: string
  }): Promise<ConversationAgentSession | FormAgentSession> {
    await this.updateMessageStatusWithIds({
      id: assistantMessageId,
      sessionId,
      status: "error",
      content: errorMessage,
      throwNotFound: true,
    })

    const session = await this.findSessionById({ sessionId, agentType })

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
