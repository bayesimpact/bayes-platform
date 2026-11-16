import {
  AgentSessionMessagesRoutes,
  presignAgentSessionMessageAttachmentDocumentSchema,
} from "@caseai-connect/api-contracts"
import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgentSessionReviewCampaign } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { assertReviewCampaignIsActive } from "@/domains/review-campaigns/review-campaign-status"
import { UserGuard } from "@/domains/users/user.guard"
import { AgentMessagesController } from "./agent-messages.controller"

const Routes = AgentSessionMessagesRoutes.review_campaign_tester

/**
 * Messages of a tester's conversation in a review campaign. Checked with the tester's session keys
 * on the campaign of the session, which must be active. Another campaign of the same project gives
 * no access to this session.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent", "agentSession", "agentSessionReviewCampaign")
@Controller()
export class ReviewCampaignTesterAgentMessagesController extends AgentMessagesController {
  protected readonly type = "review_campaign_tester"

  @Post(Routes.getAll.path)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, "review_campaign")
  getAll(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
  ): Promise<typeof Routes.getAll.response> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handleGetAll(request)
  }

  @Post(Routes.getMcpAppHtml.path)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, "review_campaign")
  getMcpAppHtml(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
  ): Promise<typeof Routes.getMcpAppHtml.response> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handleGetMcpAppHtml(request)
  }

  @Post(Routes.getOne.path)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, "review_campaign")
  getOne(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
    @Param("messageId") messageId: string,
  ): Promise<typeof Routes.getOne.response> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handleGetOne(request, messageId)
  }

  @Post(Routes.presignAttachmentDocument.path)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION, "review_campaign")
  @HttpCode(HttpStatus.CREATED)
  presignAttachmentDocument(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
    @Body(new ZodValidationPipe(presignAgentSessionMessageAttachmentDocumentSchema))
    { payload }: typeof Routes.presignAttachmentDocument.request,
  ): Promise<typeof Routes.presignAttachmentDocument.response> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handlePresignAttachmentDocument(request, payload)
  }

  @Post(Routes.getAttachmentDocumentTemporaryUrl.path)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, "review_campaign")
  getAttachmentDocumentTemporaryUrl(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
    @Param("attachmentDocumentId") attachmentDocumentId: string,
  ): Promise<typeof Routes.getAttachmentDocumentTemporaryUrl.response> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handleGetAttachmentDocumentTemporaryUrl(request, attachmentDocumentId)
  }
}
