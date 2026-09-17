import { URL } from "node:url"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { FilePart, ImagePart } from "ai"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  BuildLLMConfigParams,
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "@/domains/documents/pdf-pages/pdf-pages.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { modelRequiresPdfAsImages } from "@/external/llm/agent-provider"
import type { AgentMessage } from "../agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { isLLMVisibleMessage } from "./llm-visible-message.helper"
import { generateMasterPrompt } from "./master-promts/generate-master-prompt"
import type { AgentSessionScope, OnExecute, StreamingSession } from "./streaming-session.types"
import {
  createInlineCitationExtractor,
  createPassthroughCitationExtractor,
  type InlineCitationExtractor,
} from "./tools/inline-citations"
import type { SessionStateTarget } from "./tools/session-state-target"
import { llmMessageText, runTurnClassification } from "./tools/turn-classification"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ToolsService } from "./tools.service"

export type BuiltLLMRequest = {
  config: LLMConfig
  metadata: LLMMetadata
  messages: LLMChatMessage[]
  mcpClose: (() => Promise<void>) | undefined
  /**
   * Pass every streamed delta through it and flush it at the end: it strips
   * the inline source citations (`[c1]`) from the text the user sees and
   * records them for {@link classifyTurn}. A passthrough when the turn does
   * not report sources.
   */
  citations: InlineCitationExtractor
  /**
   * The post-turn step (ADR 0016): logs the cited sources and runs the
   * classification call that produces the session title, the categories
   * and, when nothing was cited inline, the sources. Call it once the reply
   * is complete, with the final text. Never throws.
   */
  classifyTurn: (params: { answerText: string }) => Promise<void>
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
export class AgentLlmRequestService {
  private readonly logger = new Logger(AgentLlmRequestService.name)

  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly pdfPagesService: PdfPagesService,

    private readonly toolsService: ToolsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async buildLLMRequest({
    agentSessionScope,
    getProviderForModel,
    buildLLMConfig,
    onToolExecute,
    attachmentDocumentId,
    includeSessionMetadataTools = true,
    extraTags = [],
    sessionState,
    syntheticUserContent,
  }: {
    agentSessionScope: AgentSessionScope
    getProviderForModel: (model: string) => LLMProvider
    buildLLMConfig: (params: BuildLLMConfigParams) => LLMConfig
    onToolExecute: OnExecute
    attachmentDocumentId?: string
    includeSessionMetadataTools?: boolean
    extraTags?: string[]
    sessionState?: SessionStateTarget
    /**
     * A user-role message appended for this call only, never persisted nor
     * shown: it triggers a turn the user did not type (a sub-agent's first
     * turn after a handoff, the parent's turn after a conclusion).
     */
    syntheticUserContent?: string
  }): Promise<BuiltLLMRequest> {
    const { session, agent, agentSettings, connectScope } = agentSessionScope

    const {
      tools,
      mcpClose,
      toolDescriptions,
      fireAndForgetToolNames,
      turnClassification,
      hasSubAgentTools,
    } = await this.toolsService.buildTools({
      agentSessionScope,
      getProviderForModel,
      buildLLMConfig,
      includeSessionMetadataTools,
      onExecute: onToolExecute,
      sessionState,
    })

    const toolNames = tools ? Object.keys(tools) : []
    const llmFeatures = await this.projectsService.getLlmFeatures(connectScope)
    const config = buildLLMConfig({
      systemPrompt: generateMasterPrompt({
        agent,
        agentSettings,
        toolNames,
        toolDescriptions,
        handoff: agentSessionScope.handoff
          ? { parentAgentName: agentSessionScope.handoff.parentAgent.name }
          : undefined,
      }),
      model: agentSettings.model,
      temperature: agentSettings.temperature,
      tools,
      fireAndForgetToolNames,
      priorityCallsEnabled: agentSettings.priorityCallsEnabled,
      llmFeatures,
    })

    const metadata: LLMMetadata = this.buildLLMData({
      session,
      agent,
      agentSettings,
      hasSubAgentTools,
      extraTags,
      // Langfuse: the turns of one user message share a number; the label says
      // which one is the sub-agent's, and which one the parent's resumption.
      spanLabel: agentSessionScope.handoff
        ? `handoff · ${agent.name}`
        : syntheticUserContent !== undefined
          ? "resume"
          : undefined,
    })

    const messages = await this.convertToLLMFormat(session.messages)
    if (syntheticUserContent !== undefined) {
      messages.push({ role: "user", content: syntheticUserContent })
    }

    // If there's an attachment document, we need to handle it and add it to the LLM messages
    if (attachmentDocumentId)
      await this.handleAttachmentDocumentInLLMMessage({
        llmMessages: messages,
        attachmentDocumentId,
        connectScope,
        model: agentSettings.model,
      })

    const citations = turnClassification?.retrievedChunksRegistry
      ? createInlineCitationExtractor()
      : createPassthroughCitationExtractor()
    const classifyTurn = async ({ answerText }: { answerText: string }) => {
      if (!turnClassification) return
      // The history sent to the model ends with the current user message.
      const currentUserMessage = messages.at(-1)
      await runTurnClassification({
        context: turnClassification,
        provider: getProviderForModel(agentSettings.model),
        buildConfig: (classifierSystemPrompt) =>
          buildLLMConfig({
            systemPrompt: classifierSystemPrompt,
            model: agentSettings.model,
            temperature: 0,
            priorityCallsEnabled: agentSettings.priorityCallsEnabled,
            llmFeatures,
          }),
        metadata,
        earlierMessages: messages.slice(0, -1),
        userMessage: currentUserMessage ? llmMessageText(currentUserMessage) : "",
        answerText,
        citedChunkAliases: citations.citedAliases(),
      })
    }

    return { config, metadata, messages, mcpClose, citations, classifyTurn }
  }

  private buildLLMData({
    session,
    agent,
    agentSettings,
    hasSubAgentTools,
    extraTags,
    spanLabel,
  }: {
    session: StreamingSession
    agent: Agent
    agentSettings: AgentSettings
    hasSubAgentTools: boolean
    extraTags: string[]
    spanLabel?: string
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
      ...(spanLabel ? { spanLabel } : {}),
    }
  }

  private async handleAttachmentDocumentInLLMMessage({
    llmMessages,
    attachmentDocumentId,
    connectScope,
    model,
  }: {
    llmMessages: LLMChatMessage[]
    attachmentDocumentId: string
    connectScope: RequiredConnectScope
    model: string
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

    const llmMessage: LLMChatMessage = {
      role: "user",
      content: [{ type: "text", text: message.content as string }],
    }

    switch (attachmentDocument.mimeType) {
      case "application/pdf":
        {
          if (modelRequiresPdfAsImages(model)) {
            // Image-only models: send one rendered page image URL per page. The
            // pages live in GCS (rendered once by pdf-converter, cached)
            const imageUrls = await this.pdfPagesService.getImageUrls({
              document: attachmentDocument,
              onPageCountUpdate: async (pdfPageCount: number) => {
                await this.agentMessageAttachmentDocumentsService.updatePdfPageCount({
                  attachmentDocumentId: attachmentDocument.id,
                  connectScope,
                  pdfPageCount,
                })
              },
              fileStorageService: this.fileStorageService,
            })
            const content = llmMessage.content as Array<ImagePart>
            content.push(
              ...imageUrls.map(
                (imageUrl): ImagePart => ({ type: "image", image: new URL(imageUrl) }),
              ),
            )
          } else {
            // Other models accept pdf file parts directly (signed URL; the AI
            // SDK downloads it when the provider doesn't support URLs).
            const url = await this.fileStorageService.getTemporaryUrl(
              attachmentDocument.storageRelativePath,
            )
            const data = new URL(url)
            const content = llmMessage.content as Array<FilePart>
            content.push({
              type: "file",
              mediaType: "application/pdf",
              data,
              filename: attachmentDocument.fileName,
            })
          }
        }
        break

      case "image/png":
      case "image/jpeg":
      case "image/jpg":
        {
          const url = await this.fileStorageService.getTemporaryUrl(
            attachmentDocument.storageRelativePath,
          )
          const image = new URL(url)

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
