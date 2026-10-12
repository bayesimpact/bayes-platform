import {
  type AgentSessionMessagesRoutes,
  agentSessionMessageAttachmentAllowedMimeTypes,
} from "@caseai-connect/api-contracts"
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { v4 } from "uuid"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { BaseAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import {
  extractFileExtension,
  normalizeUploadedFileName,
} from "@/domains/documents/documents.helpers"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import type { ConversationAgentSession } from "../../conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "../../conversation-agent-sessions/conversation-agent-sessions.service"
import { toDto, toDtos, toMcpAppHtmlDtos } from "./agent-message.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "./agent-message-attachment-documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAppHtmlService } from "./mcp-app-html.service"

type Routes = (typeof AgentSessionMessagesRoutes)[BaseAgentSessionType]

/**
 * Base of the live and playground session message controllers. Each subclass serves one session
 * type on its own route set and checks its own permissions, and the handlers here answer 404 for
 * a session of the other type, so a live permission never opens a playground session.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses inherit for
 * dependency injection.
 */
@Injectable()
export abstract class AgentMessagesController {
  protected abstract readonly type: BaseAgentSessionType

  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  protected async handleGetAll(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<Routes["getAll"]["response"]> {
    this.assertSessionType(request)
    const connectScope = getRequiredConnectScope(request)
    const agentSessionId = request.agentSession.id
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId,
      connectScope,
    })
    // MCP App HTML is served by `getMcpAppHtml`: reading it connects to every MCP server the
    // transcript points at, which used to hold the whole thread behind a spinner.
    return { data: toDtos(messages) }
  }

  protected async handleGetMcpAppHtml(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<Routes["getMcpAppHtml"]["response"]> {
    this.assertSessionType(request)
    const connectScope = getRequiredConnectScope(request)
    const agentSessionId = request.agentSession.id
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId,
      connectScope,
    })
    const htmlByKey = await this.mcpAppHtmlService.readLiveHtml({
      agentId: request.agent.id,
      sessionId: agentSessionId,
      messages,
      // Cards are re-read in the agent's published language: a draft under
      // edit does not change what an existing conversation shows.
      resolveLocale: async () => {
        const agentSettings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: request.agent.id,
        })
        return agentSettings.locale
      },
    })
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  protected async handleGetOne(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    messageId: string,
  ): Promise<Routes["getOne"]["response"]> {
    this.assertSessionType(request)
    const connectScope = getRequiredConnectScope(request)
    const message = await this.conversationAgentSessionsService.getMessageById({
      id: messageId,
      agentSessionId: request.agentSession.id,
      connectScope,
    })
    if (!message) {
      throw new NotFoundException("Message not found")
    }
    // The client polls this while a reply is still being written; the MCP App HTML it may
    // need once settled is loaded through `getMcpAppHtml`, off the polling path.
    return { data: toDto(message) }
  }

  protected async handlePresignAttachmentDocument(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    payload: Routes["presignAttachmentDocument"]["request"]["payload"],
  ): Promise<Routes["presignAttachmentDocument"]["response"]> {
    this.assertSessionType(request)
    if (!payload.fileName || !payload.fileName.trim()) {
      throw new UnprocessableEntityException("File name is required.")
    }
    if (!payload.mimeType) {
      throw new UnprocessableEntityException("File MIME type is required.")
    }
    if (typeof payload.size !== "number" || !Number.isFinite(payload.size) || payload.size <= 0) {
      throw new UnprocessableEntityException("File size must be greater than zero.")
    }
    if (!agentSessionMessageAttachmentAllowedMimeTypes.includes(payload.mimeType)) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${payload.mimeType}. Allowed types: PDF, PNG, or JPEG.`,
      )
    }

    const normalizedFileName = normalizeUploadedFileName(payload.fileName)
    const extension = extractFileExtension(normalizedFileName)
    const connectScope = getRequiredConnectScope(request)
    const attachmentDocumentId = v4()
    const storageRelativePath = this.fileStorageService.buildStorageRelativePath({
      connectScope,
      documentId: attachmentDocumentId,
      extension,
    })
    const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
      storagePath: storageRelativePath,
      mimeType: payload.mimeType,
      expiresInSeconds: 900,
    })

    await this.agentMessageAttachmentDocumentsService.createAttachmentDocument({
      attachmentDocumentId,
      connectScope,
      fields: {
        fileName: normalizedFileName,
        mimeType: payload.mimeType,
        size: payload.size,
        storageRelativePath,
      },
    })

    return { data: { attachmentDocumentId, uploadUrl } }
  }

  protected async handleGetAttachmentDocumentTemporaryUrl(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    attachmentDocumentId: string,
  ): Promise<Routes["getAttachmentDocumentTemporaryUrl"]["response"]> {
    this.assertSessionType(request)
    const attachmentDocument = await this.agentMessageAttachmentDocumentsService.findById({
      connectScope: getRequiredConnectScope(request),
      attachmentDocumentId,
    })
    if (!attachmentDocument) {
      throw new NotFoundException("Attachment document not found")
    }

    return {
      data: {
        url: await this.fileStorageService.getTemporaryUrl(attachmentDocument.storageRelativePath),
      },
    }
  }

  private assertSessionType(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): void {
    if (request.agentSession.type !== this.type) throw new NotFoundException()
  }
}
