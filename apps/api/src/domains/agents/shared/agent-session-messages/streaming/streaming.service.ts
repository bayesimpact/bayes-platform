import { URL } from "node:url"
import {
  DocumentsRagMode,
  type StreamEvent,
  type StreamEventPayload,
  ToolName,
} from "@caseai-connect/api-contracts"
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { FilePart, ImagePart, ToolSet } from "ai"
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
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { FormAgentSessionsService } from "@/domains/agents/form-agent-sessions/form-agent-sessions.service"
import { AgentSubAgentsService } from "@/domains/agents/sub-agents/agent-sub-agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentChunkRetrievalService } from "@/domains/documents/embeddings/document-chunk-retrieval.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import { ProjectsService } from "@/domains/projects/projects.service"
import { ServiceWithLLM } from "@/external/llm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { buildConversationAgentPrompt } from "./master-promts/conversation-agent.prompt"
import { buildFormAgentPrompt } from "./master-promts/form-agent.prompt"
import type { PublicStreamingSessionProxy, StreamingSession } from "./streaming-session.types"
import { type BuiltTools, buildSubAgentTools } from "./sub-agent-tools"
import { fillFormTool } from "./tools/fill-form.tool"
import { recalculateConversationSessionMetadataTool } from "./tools/recalculate-conversation-session-metadata.tool"
import { retrieveProjectDocumentChunksTool } from "./tools/retrieve-project-document-chunks.tool"
import { sourcesTool } from "./tools/sources.tool"
import { surfaceResourcesTool } from "./tools/surface-resources.tool"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

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

    @Inject(FormAgentSessionsService)
    private readonly formAgentSessionsService: FormAgentSessionsService,
    @Inject(ConversationAgentSessionsService)
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    @Inject(AgentSubAgentsService)
    private readonly agentSubAgentsService: AgentSubAgentsService,
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,

    private readonly documentChunkRetrievalService: DocumentChunkRetrievalService,
    private readonly mcpClientService: McpClientService,
    private readonly mcpServersService: McpServersService,

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
    connectScope,
    sessionId,
    agent,
    userContent,
    attachmentDocumentId,
    notifyClient,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agent: Agent
    userContent: string
    attachmentDocumentId?: string
    notifyClient: NotifyClient
  }): AsyncGenerator<StreamEvent, void, unknown> {
    const { session: updatedSession, assistantMessageId } = await this.prepareForStreaming({
      connectScope,
      sessionId,
      userContent,
      attachmentDocumentId,
      agentType: agent.type,
    })

    yield this.sseEvent({ type: "start", messageId: assistantMessageId })

    let fullContent = ""
    let mcpClose: (() => Promise<void>) | undefined

    try {
      const llmRequest = await this.buildLLMRequest({
        agent,
        sessionId,
        notifyClient,
        session: updatedSession,
        attachmentDocumentId,
        connectScope,
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
        agent,
        sessionId: publicSessionId,
        notifyClient,
        session: sessionProxy,
        connectScope,
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
    agent,
    sessionId,
    notifyClient,
    session,
    attachmentDocumentId,
    connectScope,
    assistantMessageId,
  }: {
    assistantMessageId: string
    agent: Agent
    sessionId: string
    notifyClient: NotifyClient
    session: StreamingSession
    attachmentDocumentId?: string
    connectScope: RequiredConnectScope
  }) {
    const { tools, mcpClose, toolDescriptions } = await this.buildTools({
      agent,
      sessionId,
      session,
      connectScope,
      onExecute: async (toolExecution) =>
        await this.persistToolExecutionAndNotifyClient({
          connectScope,
          assistantMessageId,
          sessionId,
          notifyClient,
          toolExecution,
        }),
    })

    const toolNames = tools ? Object.keys(tools) : []
    const config = this.buildLLMConfig({
      systemPrompt: this.generateMasterPrompt({ agent, toolNames, toolDescriptions }),
      model: agent.model,
      temperature: agent.temperature,
      tools,
    })

    const metadata: LLMMetadata = {
      traceId: session.traceId,
      agentSessionId: session.id,
      agentId: agent.id,
      projectId: agent.projectId,
      organizationId: session.organizationId,
      currentTurn: session.messages.filter((message) => message.role === "user").length,
      tags: [agent.name],
    }

    const messages = await this.convertToLLMFormat(session.messages)
    if (attachmentDocumentId)
      await this.handleAttachmentDocumentInLLMMessage({
        llmMessages: messages,
        attachmentDocumentId,
        connectScope,
      })

    return { config, metadata, messages, mcpClose }
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

  private generateMasterPrompt(params: {
    agent: Agent
    toolDescriptions?: Record<string, string>
    toolNames: string[]
  }): string {
    const agentType = params.agent.type
    switch (agentType) {
      case "form":
        return buildFormAgentPrompt(params)
      case "conversation":
        return buildConversationAgentPrompt(params)
      default:
        throw new Error(`Unsupported agent type: ${agentType}`)
    }
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
    agentType,
    connectScope,
    attachmentDocumentId,
    sessionId,
    userContent,
  }: {
    agentType: Agent["type"]
    connectScope: RequiredConnectScope
    attachmentDocumentId?: string
    sessionId: string
    userContent: string
  }): Promise<{
    session: ConversationAgentSession | FormAgentSession
    assistantMessageId: string
  }> {
    const session = await this.findSessionById({ sessionId, agentType })

    if (!session) {
      throw new NotFoundException(`AgentSession with id ${sessionId} not found`)
    }

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

  private buildConversationTools({
    agent,
    sessionId,
    connectScope,
    currentCategoryNames,
    hasSourcesTool,
    includeSessionMetadataTools,
    mcpTools,
    onExecute,
    subAgentTools,
  }: {
    agent: Agent
    sessionId: string
    connectScope: RequiredConnectScope
    currentCategoryNames: string[]
    hasSourcesTool: boolean
    includeSessionMetadataTools: boolean
    mcpTools: ToolSet
    onExecute: (toolExecution: ToolExecutionLog) => void
    subAgentTools: ToolSet
  }): ToolSet {
    const hasRecalculateConversationSessionMetadataTool =
      includeSessionMetadataTools && (agent.sessionCategories?.length ?? 0) > 0

    const tools: ToolSet = {
      ...(agent.documentsRagMode === DocumentsRagMode.None
        ? {}
        : {
            [ToolName.RetrieveProjectDocumentChunks]: retrieveProjectDocumentChunksTool({
              connectScope,
              documentTagIds:
                agent.documentsRagMode === DocumentsRagMode.Tags
                  ? (agent.documentTags?.map((documentTag) => documentTag.id) ?? [])
                  : [],
              retrievalService: this.documentChunkRetrievalService,
              onExecute,
            }),
          }),
      ...(hasSourcesTool ? { [ToolName.Sources]: sourcesTool({ onExecute }) } : {}),
      ...((agent.resourceLibraries?.length ?? 0) > 0
        ? { [ToolName.SurfaceResources]: surfaceResourcesTool({ onExecute }) }
        : {}),
      ...(hasRecalculateConversationSessionMetadataTool
        ? {
            [ToolName.RecalculateConversationSessionMetadata]:
              recalculateConversationSessionMetadataTool({
                connectScope,
                sessionId,
                availableCategoryNames: (agent.sessionCategories ?? [])
                  .map((agentSessionCategory) => agentSessionCategory.name)
                  .sort((leftCategoryName, rightCategoryName) =>
                    leftCategoryName.localeCompare(rightCategoryName),
                  ),
                currentCategoryNames,
                conversationAgentSessionsService: this.conversationAgentSessionsService,
                onExecute,
              }),
          }
        : {}),
    }

    this.addToolsWithoutCollisions({ target: tools, source: mcpTools, sourceLabel: "MCP" })
    this.addToolsWithoutCollisions({
      target: tools,
      source: subAgentTools,
      sourceLabel: "sub-agent",
    })
    return tools
  }

  private async buildTools({
    agent,
    sessionId,
    session,
    connectScope,
    includeSessionMetadataTools = true,
    includeSubAgentTools = true,
    onExecute,
  }: {
    agent: Agent
    sessionId: string
    session?: StreamingSession
    connectScope: RequiredConnectScope
    includeSessionMetadataTools?: boolean
    includeSubAgentTools?: boolean
    onExecute: (toolExecution: ToolExecutionLog) => void
  }): Promise<BuiltTools> {
    const hasSourcesTool = await this.projectsService.hasFeature({
      connectScope,
      feature: "sources-tool",
    })
    const mcpCloseFns: (() => Promise<void>)[] = []
    const mcpTools: ToolSet = {}
    const mcpToolDescriptions: Record<string, string> = {}

    const serverConfigs = await this.mcpServersService.getEnabledServersForAgent(agent.id)
    for (const serverConfig of serverConfigs) {
      const mcpSession = await this.mcpClientService.connect(serverConfig)
      mcpCloseFns.push(mcpSession.close)
      for (const [toolName, toolDef] of Object.entries(mcpSession.tools)) {
        const originalExecute = toolDef.execute
        if (!originalExecute) continue
        const description = this.getToolDescription(toolDef)
        if (description) mcpToolDescriptions[toolName] = description
        mcpTools[toolName] = {
          ...toolDef,
          execute: (async (...executeArgs: Parameters<typeof originalExecute>) => {
            this.logger.log(
              `[MCP] Calling tool "${toolName}" with args: ${JSON.stringify(executeArgs[0])}`,
            )
            onExecute({
              toolName,
              arguments: (executeArgs[0] ?? {}) as Record<string, unknown>,
            })
            try {
              const result = await originalExecute(...executeArgs)
              this.logger.log(`[MCP] Tool "${toolName}" returned: ${JSON.stringify(result)}`)
              return result
            } catch (error) {
              this.logger.error(`[MCP] Tool "${toolName}" failed: ${error}`)
              throw error
            }
          }) as typeof originalExecute,
        }
      }
    }

    const mcpClose =
      mcpCloseFns.length > 0
        ? async () => {
            for (const closeFn of mcpCloseFns) await closeFn()
          }
        : undefined

    switch (agent.type) {
      case "conversation": {
        const currentCategoryNames =
          includeSessionMetadataTools && (agent.sessionCategories?.length ?? 0) > 0
            ? await this.conversationAgentSessionsService.getCurrentCategoryNamesForSession({
                connectScope,
                sessionId,
              })
            : []
        const { tools: subAgentTools, toolDescriptions: subAgentToolDescriptions } =
          includeSubAgentTools
            ? await buildSubAgentTools({
                agent,
                agentSubAgentsService: this.agentSubAgentsService,
                buildLLMConfig: (params) => this.buildLLMConfig(params),
                buildTools: (params) => this.buildTools(params),
                connectScope,
                generateMasterPrompt: (params) => this.generateMasterPrompt(params),
                getProviderForModel: (model) => this.getProviderForModel(model),
                onExecute,
                projectsService: this.projectsService,
                session,
                sessionId,
              })
            : { tools: {}, toolDescriptions: {} }
        const tools = this.buildConversationTools({
          agent,
          sessionId,
          connectScope,
          currentCategoryNames,
          hasSourcesTool,
          includeSessionMetadataTools,
          mcpTools,
          onExecute,
          subAgentTools,
        })

        return {
          mcpClose,
          tools,
          toolDescriptions: this.filterToolDescriptions({
            descriptions: { ...mcpToolDescriptions, ...subAgentToolDescriptions },
            tools,
          }),
        }
      }

      case "form":
        return {
          mcpClose,
          toolDescriptions: {},
          tools: {
            [ToolName.FillForm]: fillFormTool({
              connectScope,
              agent,
              sessionId,
              formAgentSessionsService: this.formAgentSessionsService,
              onExecute,
            }),
            ...((agent.resourceLibraries?.length ?? 0) > 0
              ? { [ToolName.SurfaceResources]: surfaceResourcesTool({ onExecute }) }
              : {}),
          } as ToolSet,
        }

      default:
        return { mcpClose, toolDescriptions: {}, tools: undefined }
    }
  }

  private addToolsWithoutCollisions({
    source,
    sourceLabel,
    target,
  }: {
    source: ToolSet
    sourceLabel: string
    target: ToolSet
  }) {
    for (const [toolName, toolDef] of Object.entries(source)) {
      if (target[toolName]) {
        this.logger.warn(
          `Skipping ${sourceLabel} tool "${toolName}" because another tool with the same name is already registered.`,
        )
        continue
      }
      target[toolName] = toolDef
    }
  }

  private filterToolDescriptions({
    descriptions,
    tools,
  }: {
    descriptions: Record<string, string>
    tools: ToolSet | undefined
  }): Record<string, string> {
    if (!tools) return {}

    return Object.fromEntries(
      Object.keys(tools)
        .map((toolName) => [toolName, descriptions[toolName]] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== undefined),
    )
  }

  private getToolDescription(toolDef: unknown): string | undefined {
    if (!toolDef || typeof toolDef !== "object" || !("description" in toolDef)) {
      return undefined
    }

    const description = (toolDef as { description?: unknown }).description
    return typeof description === "string" && description.trim().length > 0
      ? description
      : undefined
  }

  private async persistToolExecutionAndNotifyClient({
    connectScope,
    sessionId,
    notifyClient,
    toolExecution,
    assistantMessageId,
  }: {
    assistantMessageId: string
    connectScope: RequiredConnectScope
    sessionId: string
    notifyClient: NotifyClient
    toolExecution: ToolExecutionLog
  }): Promise<void> {
    const toolCall = {
      id: v4(),
      name: toolExecution.toolName,
      arguments: toolExecution.arguments,
    }

    // Create a tool message in the database for each tool call, so that the session history is complete and reflects what actually happened during the agent execution (including tool calls)
    await this.agentMessageConnectRepository.createAndSave(connectScope, {
      id: v4(),
      sessionId,
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
