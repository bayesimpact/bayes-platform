import {
  ReviewCampaignsRoutes,
  type ReviewerSessionListItemDto,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaignMembership } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { ReviewerGuard } from "./reviewer.guard"
import type { ReviewerSessionSummary } from "./reviewer.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "./reviewer.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ReviewerGuard)
@RequireContext("organization", "project", "reviewCampaign", "reviewCampaignMembership")
@Controller()
export class ReviewerSessionsController {
  constructor(private readonly reviewerService: ReviewerService) {}

  @Get(ReviewCampaignsRoutes.listReviewerSessions.path)
  @CheckPolicy((policy) => policy.canList())
  async listReviewerSessions(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.listReviewerSessions.response> {
    const summaries = await this.reviewerService.listSessionsForCampaign({
      campaignId: request.reviewCampaign.id,
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
