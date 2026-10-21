import {
  ReviewCampaignsRoutes,
  type ReviewerSessionListItemDto,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaign } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewerSessionSummary } from "./reviewer.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "./reviewer.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "reviewCampaign")
@Controller()
export class ReviewerSessionsController {
  constructor(private readonly reviewerService: ReviewerService) {}

  @Get(ReviewCampaignsRoutes.listReviewerSessions.path)
  @CheckPermission(REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION, "review_campaign")
  async listReviewerSessions(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<typeof ReviewCampaignsRoutes.listReviewerSessions.response> {
    const summaries = await this.reviewerService.listSessionsForCampaign({
      campaign: request.reviewCampaign,
      reviewerUserId: request.user.id,
    })
    return { data: { sessions: summaries.map(toReviewerSessionListItemDto) } }
  }
}

function toReviewerSessionListItemDto(summary: ReviewerSessionSummary): ReviewerSessionListItemDto {
  return {
    sessionId: summary.sessionId,
    agentType: summary.agentType,
    testerUserId: summary.testerUserId,
    startedAt: summary.startedAt.getTime(),
    messageCount: summary.messageCount,
    reviewerCount: summary.reviewerCount,
    callerHasReviewed: summary.callerHasReviewed,
    callerIsSessionOwner: summary.callerIsSessionOwner,
  }
}
