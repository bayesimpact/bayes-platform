import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { Controller, HttpStatus, Inject, NotFoundException, Req } from "@nestjs/common"
import { v4 } from "uuid"
import type {
  EndpointRequestWithConversationAgentSession,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import {
  toDtos,
  toMcpAppHtmlDtos,
} from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageAttachmentDocumentsService } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageFeedbackService } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
import {
  extractFileExtension,
  normalizeUploadedFileName,
} from "@/domains/documents/documents.helpers"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import {
  AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_READ_PERMISSION,
  PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"

const CONVERSATION_CONTEXT = ["organization", "project", "agent", "agentSession"] as const

/**
 * The messages of a live conversation: the transcript, the HTML of its MCP Apps, its attachments
 * and the feedback on a reply. A copy of `AgentMessagesController` and of
 * `AgentMessageFeedbackController.createOne`.
 */
@Controller()
export class DeskConversationMessagesController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
    private readonly agentMessageFeedbackService: AgentMessageFeedbackService,
  ) {}

  @SchemaRoute(DeskConversationsRoutes.getMessages, {
    permission: { key: AGENT_CONVERSATION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...CONVERSATION_CONTEXT],
  })
  async getMessages(
    @Req() request: EndpointRequestWithConversationAgentSession,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.getMessages>> {
    assertLiveSession(request)
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId: request.agentSession.id,
      connectScope: getRequiredConnectScope(request),
    })
    // The HTML of the MCP Apps loads through `getMcpAppsHtml`: reading it connects to every MCP
    // server the transcript points at, which would hold the whole thread behind a spinner.
    return { data: toDtos(messages) }
  }

  @SchemaRoute(DeskConversationsRoutes.getMcpAppsHtml, {
    permission: { key: AGENT_CONVERSATION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...CONVERSATION_CONTEXT],
  })
  async getMcpAppsHtml(
    @Req() request: EndpointRequestWithConversationAgentSession,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.getMcpAppsHtml>> {
    assertLiveSession(request)
    const agentSessionId = request.agentSession.id
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId,
      connectScope: getRequiredConnectScope(request),
    })
    const htmlByKey = await this.mcpAppHtmlService.readLiveHtml({
      agentId: request.agent.id,
      sessionId: agentSessionId,
      messages,
    })
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  /**
   * The schema checks the MIME type, the size and that the file name is not empty before any URL
   * is signed. A blank file name, or one ending in a dot, gets its 422 from
   * `extractFileExtension`, as on the live route.
   */
  @SchemaRoute(DeskConversationsRoutes.presignAttachment, {
    permission: { key: AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: [...CONVERSATION_CONTEXT],
    status: HttpStatus.CREATED,
  })
  async presignAttachment(
    @Req() request: EndpointRequestWithConversationAgentSession,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskConversationsRoutes.presignAttachment>,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.presignAttachment>> {
    assertLiveSession(request)
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
      contentLength: payload.size,
    })

    await this.agentMessageAttachmentDocumentsService.createAttachmentDocument({
      attachmentDocumentId,
      agentSessionId: request.agentSession.id,
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

  @SchemaRoute(DeskConversationsRoutes.getAttachmentUrl, {
    permission: { key: AGENT_CONVERSATION_SESSION_READ_PERMISSION, on: "agent" },
    context: [...CONVERSATION_CONTEXT],
  })
  async getAttachmentUrl(
    @Req() request: EndpointRequestWithConversationAgentSession,
    @RouteInput() { params }: SchemaRouteInput<typeof DeskConversationsRoutes.getAttachmentUrl>,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.getAttachmentUrl>> {
    assertLiveSession(request)
    const connectScope = getRequiredConnectScope(request)
    const { attachmentDocumentId } = params
    const attachmentDocument = await this.agentMessageAttachmentDocumentsService.findById({
      connectScope,
      attachmentDocumentId,
    })
    // A file is read through the conversation that holds it: the attachment of another
    // conversation of the project answers 404, as if absent.
    const isOfThisConversation =
      attachmentDocument !== null &&
      (await this.conversationAgentSessionsService.hasMessageWithAttachment({
        agentSessionId: request.agentSession.id,
        attachmentDocumentId,
        connectScope,
      }))
    if (!attachmentDocument || !isOfThisConversation) {
      throw new NotFoundException("Attachment document not found")
    }

    return {
      data: {
        url: await this.fileStorageService.getTemporaryUrl(attachmentDocument.storageRelativePath),
      },
    }
  }

  /** The service answers 404 for a message that is not in one of the caller's conversations. */
  @SchemaRoute(DeskConversationsRoutes.createMessageFeedback, {
    permission: { key: PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async createMessageFeedback(
    @Req() request: EndpointRequestWithProject,
    @RouteInput()
    { params, payload }: SchemaRouteInput<typeof DeskConversationsRoutes.createMessageFeedback>,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.createMessageFeedback>> {
    await this.agentMessageFeedbackService.createFeedback({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentMessageId: params.agentMessageId,
      rating: payload.rating,
      // A thumbs-up needs no text: it is saved with an empty one, as on the live route.
      content: payload.content ?? "",
    })
    return { data: { success: true } }
  }
}

/** A Desk route serves live conversations only: a session of another type answers 404. */
function assertLiveSession(request: EndpointRequestWithConversationAgentSession): void {
  if (request.agentSession.type !== "live") throw new NotFoundException()
}
