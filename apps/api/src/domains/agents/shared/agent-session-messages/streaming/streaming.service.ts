import { URL } from "node:url"
import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { FilePart, ImagePart } from "ai"
import type { Repository } from "typeorm/repository/Repository"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { ServiceWithLLM } from "@/external/llm"
import { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { generateMasterPrompt } from "./master-promts/generate-master-prompt"
import type {
  AgentSessionScope,
  PublicStreamingSessionProxy,
  StreamingSession,
} from "./streaming-session.types"
import type { ToolExecutionLog } from "./tools/tool-execution-log"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ToolsService } from "./tools.service"

type NotifyClient = (event: Extract<StreamEvent, { type: "notify_client" }>) => void

@Injectable()
export class StreamingService extends ServiceWithLLM {
  private readonly logger = new Logger(StreamingService.name)
  private readonly STREAM_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  private readonly agentMessageRepository: Repository<AgentMessage>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>
  private readonly formAgentSessionRepository: Repository<FormAgentSession>

  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,

    private readonly toolsService: ToolsService,

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
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({ mockLlmProvider, vertexLlmProvider, medGemmaLlmProvider, gemmaLlmProvider })

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
      const llmRequest = await this.buildLLMRequest({
        agentSessionScope,
        notifyClient,
        attachmentDocumentId,
        assistantMessageId,
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
    userContent,
    notifyClient,
  }: {
    connectScope: RequiredConnectScope
    publicSessionId: string
    agent: Agent
    userContent: string
    notifyClient: NotifyClient
  }): AsyncGenerator<StreamEvent, void, unknown> {
    await this.recoverAbortedStreams(publicSessionId)

    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      sessionId: publicSessionId,
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
      const llmRequest = await this.buildLLMRequest({
        agentSessionScope: { session: sessionProxy, agent, connectScope },
        notifyClient,
        assistantMessageId,
      })
      mcpClose = llmRequest.mcpClose

      const chunks = this.getProviderForModel(llmRequest.config.model).streamChatResponse(
        llmRequest,
      )
      for await (const chunk of chunks) {
        fullContent += chunk
        yield this.sseEvent({ type: "chunk", content: chunk, messageId: assistantMessageId })
      }

      const assistantMessage = await this.agentMessageRepository.findOne({
        where: { id: assistantMessageId, sessionId: publicSessionId },
      })
      if (assistantMessage) {
        assistantMessage.status = "completed"
        assistantMessage.content = fullContent
        assistantMessage.completedAt = new Date()
        await this.agentMessageRepository.save(assistantMessage)
      }

      yield this.sseEvent({ type: "end", messageId: assistantMessageId, fullContent })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      const assistantMessage = await this.agentMessageRepository.findOne({
        where: { id: assistantMessageId, sessionId: publicSessionId },
      })
      if (assistantMessage) {
        assistantMessage.status = "error"
        assistantMessage.content = errorMessage
        assistantMessage.completedAt = new Date()
        await this.agentMessageRepository.save(assistantMessage)
      }

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

  private async buildLLMRequest({
    agentSessionScope,
    notifyClient,
    attachmentDocumentId,
    assistantMessageId,
  }: {
    agentSessionScope: AgentSessionScope
    assistantMessageId: string
    notifyClient: NotifyClient
    attachmentDocumentId?: string
  }) {
    const { session, agent, connectScope } = agentSessionScope

    const { tools, mcpClose, toolDescriptions, hasSubAgentTools } =
      await this.toolsService.buildTools({
        agentSessionScope,
        onExecute: async (toolExecution) => {
          await this.persistToolExecutionAndNotifyClient({
            agentSessionScope,
            assistantMessageId,
            notifyClient,
            toolExecution,
          })
        },
      })

    const toolNames = tools ? Object.keys(tools) : []
    const config = this.buildLLMConfig({
      systemPrompt: generateMasterPrompt({ agent, toolNames, toolDescriptions }),
      model: agent.model,
      temperature: agent.temperature,
      tools,
    })

    const metadata: LLMMetadata = this.buildLLMData({ session, agent, hasSubAgentTools })

    const messages = await this.convertToLLMFormat(session.messages)

    // If there's an attachment document, we need to handle it and add it to the LLM messages
    if (attachmentDocumentId)
      await this.handleAttachmentDocumentInLLMMessage({
        llmMessages: messages,
        attachmentDocumentId,
        connectScope,
      })

    return { config, metadata, messages, mcpClose }
  }

  private buildLLMData({
    session,
    agent,
    hasSubAgentTools,
  }: {
    session: StreamingSession
    agent: Agent
    hasSubAgentTools: boolean
  }): LLMMetadata {
    this.logger.log(
      `Agent "${agent.name}" (${agent.id}) trace: ${getTraceUrl(session.traceId)} (session ${session.id})`,
    )
    const tags = [agent.name]
    return {
      traceId: session.traceId,
      agentSessionId: session.id,
      agentId: agent.id,
      projectId: agent.projectId,
      organizationId: session.organizationId,
      currentTurn: session.messages.filter((message) => message.role === "user").length,
      tags: hasSubAgentTools ? [...tags, "parent-agent"] : tags,
    }
  }

  private async handleAttachmentDocumentInLLMMessage({
    llmMessages,
    attachmentDocumentId,
    connectScope,
  }: {
    llmMessages: LLMChatMessage[]
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
  }) {
    const message = llmMessages.pop()
    if (!message) return

    const attachmentDocument = await this.agentMessageAttachmentDocumentsService.findById({
      connectScope,
      attachmentDocumentId,
    })
    if (!attachmentDocument) {
      throw new Error(`Attachment document with ID ${attachmentDocumentId} not found`)
    }

    const url = await this.fileStorageService.getTemporaryUrl(
      attachmentDocument.storageRelativePath,
    )
    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: message.content as string }],
    }

    const hasStorageBucketName: boolean = !!process.env.GCS_STORAGE_BUCKET_NAME

    switch (attachmentDocument.mimeType) {
      case "application/pdf":
        {
          const data = new URL(
            hasStorageBucketName
              ? url
              : "https://www.impots.gouv.fr/sites/default/files/formulaires/2042/2025/2042_5180.pdf",
          )

          const content = llmMessage.content as Array<FilePart>
          content.push({
            type: "file",
            mediaType: "application/pdf",
            data,
            filename: attachmentDocument.fileName,
          })
        }
        break

      case "image/png":
      case "image/jpeg":
      case "image/jpg":
        {
          const image = new URL(
            hasStorageBucketName
              ? url
              : "https://www.oiseaux.net/photos/marc.fasol/images/id/canard.colvert.mafa.3p.230.h.jpg",
          )

          const content = llmMessage.content as Array<ImagePart>
          content.push({ type: "image", image })
        }
        break

      default:
        throw new Error(`Unsupported attachment document type: ${attachmentDocument.mimeType}`)
    }

    llmMessages.push(llmMessage)
  }

  /**
   * Converts ConversationAgentSession messages to LLM provider format
   */
  private async convertToLLMFormat(
    messages: ConversationAgentSession["messages"],
  ): Promise<LLMChatMessage[]> {
    const llmMessages: LLMChatMessage[] = []

    for (const message of messages) {
      // Skip streaming messages (they're not complete yet)
      if (message.status === "streaming") {
        continue
      }

      // Skip aborted messages
      if (message.status === "aborted") {
        continue
      }

      // Skip messages with empty content (AI SDK requires non-empty content)
      if (!message.content || message.content.trim().length === 0) {
        continue
      }

      if (message.role === "user" || message.role === "assistant") {
        llmMessages.push({
          role: message.role,
          content: message.content,
        })
      }
    }

    return llmMessages
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

    // Create user message
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      sessionId,
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
    const message = await this.agentMessageRepository.findOne({
      where: { id: assistantMessageId, sessionId },
    })

    if (!message) {
      throw new NotFoundException(
        `ChatMessage with id ${assistantMessageId} not found in session ${sessionId}`,
      )
    }

    message.content = fullContent
    message.status = "completed"
    message.completedAt = new Date()
    await this.agentMessageRepository.save(message)

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
    const message = await this.agentMessageRepository.findOne({
      where: { id: assistantMessageId, sessionId },
    })

    if (!message) {
      throw new NotFoundException(
        `ChatMessage with id ${assistantMessageId} not found in session ${sessionId}`,
      )
    }

    message.content = errorMessage
    message.status = "error"
    message.completedAt = new Date()
    await this.agentMessageRepository.save(message)

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
        message.status = "aborted"
        await this.agentMessageRepository.save(message)
      }
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
    const { session, connectScope } = agentSessionScope
    const toolCall = {
      id: v4(),
      name: toolExecution.toolName,
      arguments: toolExecution.arguments,
    }

    // Create a tool message in the database for each tool call, so that the session history is complete and reflects what actually happened during the agent execution (including tool calls)
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      id: v4(),
      sessionId: session.id,
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
