import { EvalConversationsRoutes } from "@caseai-connect/eval-contracts"
import {
  Controller,
  HttpStatus,
  Inject,
  NotFoundException,
  Req,
  UnprocessableEntityException,
} from "@nestjs/common"
import { v4 } from "uuid"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { toMcpAppHtmlDtos } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
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
  PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { assertReviewCampaignIsActive } from "@/domains/review-campaigns/review-campaign-status"
import {
  assertTesterSession,
  type EndpointRequestWithTesterSession,
  TESTER_SESSION_CONTEXT,
  toConversationMessageDtos,
} from "./conversation.mappers"

/**
 * The messages of a tester's conversation in a review campaign: the transcript, the HTML of its
 * MCP Apps, its attachments and the feedback on a reply. A copy of the logic of the abstract
 * `AgentMessagesController` of the `agents` domain, with the session type fixed to
 * `review_campaign_tester`, and of `AgentMessageFeedbackController.createOne`.
 * The session routes check the tester's keys on the campaign of the session, which must be active.
 */
@Controller()
export class EvalConversationMessagesController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly agentMessageAttachmentDocumentsService: AgentMessageAttachmentDocumentsService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
    private readonly agentMessageFeedbackService: AgentMessageFeedbackService,
  ) {}

  @SchemaRoute(EvalConversationsRoutes.getMessages, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: [...TESTER_SESSION_CONTEXT],
  })
  async getMessages(
    @Req() request: EndpointRequestWithTesterSession,
  ): Promise<SchemaRouteResponse<typeof EvalConversationsRoutes.getMessages>> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    assertTesterSession(request)
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId: request.agentSession.id,
      connectScope: getRequiredConnectScope(request),
    })
    // The HTML of the MCP Apps loads through `getMcpAppsHtml`: reading it connects to every MCP
    // server the transcript points at, which would hold the whole thread behind a spinner.
    return { data: toConversationMessageDtos(messages) }
  }

  @SchemaRoute(EvalConversationsRoutes.getMcpAppsHtml, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: [...TESTER_SESSION_CONTEXT],
  })
  async getMcpAppsHtml(
    @Req() request: EndpointRequestWithTesterSession,
  ): Promise<SchemaRouteResponse<typeof EvalConversationsRoutes.getMcpAppsHtml>> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    assertTesterSession(request)
    const agentSessionId = request.agentSession.id
    const connectScope = getRequiredConnectScope(request)
    const messages = await this.conversationAgentSessionsService.listMessagesForSession({
      agentSessionId,
      connectScope,
    })
    const htmlByKey = await this.mcpAppHtmlService.readLiveHtml({
      agentId: request.agent.id,
      connectScope,
      sessionId: agentSessionId,
      messages,
    })
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  /**
   * The schema checks the MIME type, the size and that the file name is not empty before any URL
   * is signed (422 before for a type or an empty name). A blank name still answers 422 here.
   */
  @SchemaRoute(EvalConversationsRoutes.presignAttachment, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION, on: "review_campaign" },
    context: [...TESTER_SESSION_CONTEXT],
    status: HttpStatus.CREATED,
  })
  async presignAttachment(
    @Req() request: EndpointRequestWithTesterSession,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationsRoutes.presignAttachment>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationsRoutes.presignAttachment>> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    assertTesterSession(request)
    if (!payload.fileName.trim()) {
      throw new UnprocessableEntityException("File name is required.")
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

  @SchemaRoute(EvalConversationsRoutes.getAttachmentUrl, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: [...TESTER_SESSION_CONTEXT],
  })
  async getAttachmentUrl(
    @Req() request: EndpointRequestWithTesterSession,
    @RouteInput() { params }: SchemaRouteInput<typeof EvalConversationsRoutes.getAttachmentUrl>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationsRoutes.getAttachmentUrl>> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    assertTesterSession(request)
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

  /**
   * The service answers 404 for a message that is not in one of the caller's conversations, and
   * 403 when the conversation's campaign does not give the caller the key. The schema requires a
   * rating, where a missing one was saved as a report, and caps the text.
   */
  @SchemaRoute(EvalConversationsRoutes.createMessageFeedback, {
    permission: { key: PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async createMessageFeedback(
    @Req() request: EndpointRequestWithProject,
    @RouteInput()
    { params, payload }: SchemaRouteInput<typeof EvalConversationsRoutes.createMessageFeedback>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationsRoutes.createMessageFeedback>> {
    await this.agentMessageFeedbackService.createFeedback({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentMessageId: params.agentMessageId,
      rating: payload.rating,
      // A thumbs-up needs no text: it is saved with an empty one, as on the old route.
      content: payload.content ?? "",
    })
    return { data: { success: true } }
  }
}
