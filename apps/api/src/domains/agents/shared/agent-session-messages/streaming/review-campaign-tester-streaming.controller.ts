import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Req,
  RequestMethod,
  Sse,
  UseGuards,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import type { EndpointRequestWithAgentSessionReviewCampaign } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { assertReviewCampaignIsActive } from "@/domains/review-campaigns/review-campaign-status"
import { UserGuard } from "@/domains/users/user.guard"
import { StreamingController } from "./streaming.controller"

const Routes = AgentSessionMessagesRoutes.review_campaign_tester

/**
 * Sends a message to a tester's conversation in a review campaign and streams the reply. Checked
 * with the tester's session key on the campaign of the session, which must be active. Another
 * campaign of the same project gives no access to this session.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent", "agentSession", "agentSessionReviewCampaign")
@Controller()
export class ReviewCampaignTesterStreamingController extends StreamingController {
  protected readonly type = "review_campaign_tester"

  @Sse(Routes.stream.path, { method: RequestMethod.POST })
  @HttpCode(HttpStatus.OK)
  @CheckPermission(REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION, "review_campaign")
  stream(
    @Req() request: EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>,
    @Body() body: typeof Routes.stream.request,
  ): Observable<MessageEvent> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    return this.handleStream(request, body)
  }
}
