import { URL } from "node:url"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { FilePart, ImagePart } from "ai"
import { v4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { ServiceWithLLM } from "@/external/llm"
import type { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { isLLMVisibleMessage } from "./llm-visible-message.helper"
import { generateMasterPrompt } from "./master-promts/generate-master-prompt"
import type {
  AgentSessionScope,
  OnExecute,
  PublicStreamingSessionProxy,
  StreamingSession,
} from "./streaming-session.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ToolsService } from "./tools.service"

export type BuiltLLMRequest = {
  config: LLMConfig
  metadata: LLMMetadata
  messages: LLMChatMessage[]
  mcpClose: (() => Promise<void>) | undefined
}

/**
 * Builds the full LLM request for an agent — master prompt, tools (RAG, sources,
 * resource libraries, MCP, sub-agents, ...), metadata and message history.
 *
 * This is the single source of truth for "how an agent is assembled". Every
 * caller that runs an agent (Studio streaming, public chat, evaluation runs)
 * MUST go through this service so the agent behaves identically everywhere.
 */
@Injectable()
export class AgentLlmRequestService extends ServiceWithLLM {
  private readonly logger = new Logger(AgentLlmRequestService.name)

  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,

    private readonly toolsService: ToolsService,

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
  }

  async buildLLMRequest({
    agentSessionScope,
    onToolExecute,
    attachmentDocumentId,
    includeSessionMetadataTools = true,
    extraTags = [],
  }: {
    agentSessionScope: AgentSessionScope
    onToolExecute: OnExecute
    attachmentDocumentId?: string
    includeSessionMetadataTools?: boolean
    extraTags?: string[]
  }): Promise<BuiltLLMRequest> {
    const { session, agent, agentSettings, connectScope } = agentSessionScope

    const { tools, mcpClose, toolDescriptions, hasSubAgentTools } =
      await this.toolsService.buildTools({
        agentSessionScope,
        includeSessionMetadataTools,
        onExecute: onToolExecute,
      })

    const toolNames = tools ? Object.keys(tools) : []
    const config = this.buildLLMConfig({
      systemPrompt: generateMasterPrompt({
        agent,
        agentSettings,
        toolNames,
        toolDescriptions,
      }),
      model: agentSettings.model,
      temperature: agentSettings.temperature,
      tools,
    })

    const metadata: LLMMetadata = this.buildLLMData({
      session,
      agent,
      agentSettings,
      hasSubAgentTools,
      extraTags,
    })

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

  /**
   * Runs a single user turn against an agent without a persisted session, using
   * the exact same request building (tools, master prompt, streaming provider
   * call) as Studio. Used by evaluation runs so the evaluated agent behaves
   * exactly like the Studio one.
   *
   * The only divergence from Studio: session-metadata tools are excluded because
   * there is no session row for them to mutate.
   */
  async runSingleTurn({
    agent,
    agentSettings,
    connectScope,
    userContent,
    extraTags,
  }: {
    agent: Agent
    agentSettings: AgentSettings
    connectScope: RequiredConnectScope
    userContent: string
    extraTags?: string[]
  }): Promise<{ output: string; traceId: string }> {
    const traceId = v4()
    const userMessage = { role: "user", content: userContent, status: null } as AgentMessage
    const session: PublicStreamingSessionProxy = {
      id: traceId,
      traceId,
      organizationId: connectScope.organizationId,
      messages: [userMessage],
    }

    const { config, metadata, messages, mcpClose } = await this.buildLLMRequest({
      agentSessionScope: { agent, agentSettings, session, connectScope },
      includeSessionMetadataTools: false,
      extraTags,
      onToolExecute: (toolExecution) => {
        this.logger.log(
          `Tool "${toolExecution.toolName}" executed during single-turn run (trace ${traceId})`,
        )
      },
    })

    try {
      let output = ""
      const chunks = this.getProviderForModel(config.model).streamChatResponse({
        messages,
        config,
        metadata,
      })
      for await (const chunk of chunks) {
        output += chunk
      }
      return { output, traceId }
    } finally {
      await mcpClose?.()
    }
  }

  private buildLLMData({
    session,
    agent,
    agentSettings,
    hasSubAgentTools,
    extraTags,
  }: {
    session: StreamingSession
    agent: Agent
    agentSettings: AgentSettings
    hasSubAgentTools: boolean
    extraTags: string[]
  }): LLMMetadata {
    this.logger.log(
      `Agent "${agent.name}" (${agent.id}) trace: ${getTraceUrl(session.traceId)} (session ${session.id})`,
    )
    const tags = [agent.name, `rev-${agentSettings.revision}`, agent.type, ...extraTags]
    return {
      traceId: session.traceId,
      agentSessionId: session.id,
      agentId: agent.id,
      revision: agentSettings.revision,
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
   * Converts agent session messages to LLM provider format
   */
  private async convertToLLMFormat(messages: AgentMessage[]): Promise<LLMChatMessage[]> {
    return messages.filter(isLLMVisibleMessage).map((message) => ({
      role: message.role,
      content: message.content,
    }))
  }
}
