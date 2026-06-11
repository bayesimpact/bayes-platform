import { ReviewCampaignsRoutes, type ReviewerSessionReviewDto } from "@caseai-connect/api-contracts"
import { Body, Controller, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgentSessionInCampaign,
  EndpointRequestWithReviewCampaignMembership,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewerSessionReview } from "../reviewer-session-reviews/reviewer-session-review.entity"
import { ReviewerGuard } from "./reviewer.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "./reviewer.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ReviewerGuard)
@RequireContext("organization", "project", "agentSessionInCampaign", "reviewCampaignMembership")
@Controller()
export class ReviewerSessionReviewController {
  constructor(private readonly reviewerService: ReviewerService) {}

  @Post(ReviewCampaignsRoutes.submitReviewerSessionReview.path)
  @CheckPolicy((policy) => policy.canCreate())
  async submitReviewerSessionReview(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.submitReviewerSessionReview.request,
  ): Promise<typeof ReviewCampaignsRoutes.submitReviewerSessionReview.response> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const review = await this.reviewerService.submitReview({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
      fields: payload,
    })
    return { data: toReviewerSessionReviewDto(review) }
  }

  @Patch(ReviewCampaignsRoutes.updateReviewerSessionReview.path)
  @CheckPolicy((policy) => policy.canUpdate())
  async updateReviewerSessionReview(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
    @Param("reviewId") reviewId: string,
    @Body() { payload }: typeof ReviewCampaignsRoutes.updateReviewerSessionReview.request,
  ): Promise<typeof ReviewCampaignsRoutes.updateReviewerSessionReview.response> {
    const { sessionId, userId } = request.agentSessionInCampaign
    const review = await this.reviewerService.updateReview({
      reviewId,
      sessionId,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
      fields: payload,
    })
    return { data: toReviewerSessionReviewDto(review) }
  }
}

function toReviewerSessionReviewDto(review: ReviewerSessionReview): ReviewerSessionReviewDto {
  return {
    id: review.id,
    campaignId: review.campaignId,
    sessionId: review.sessionId,
    agentType: review.agentType,
    reviewerUserId: review.reviewerUserId,
    overallRating: review.overallRating,
    comment: review.comment,
    answers: review.answers,
    submittedAt: review.submittedAt.getTime(),
    createdAt: review.createdAt.getTime(),
    updatedAt: review.updatedAt.getTime(),
  }
}
