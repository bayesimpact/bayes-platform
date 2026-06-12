import {
  type GetReviewerSessionResponseDto,
  ReviewCampaignsRoutes,
  type ReviewerSessionBlindDto,
  type ReviewerSessionFullDto,
  type ReviewerSessionReviewDto,
  type ReviewerSessionTranscriptMessageDto,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgentSessionInCampaign,
  EndpointRequestWithReviewCampaignMembership,
} from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewerSessionReview } from "../reviewer-session-reviews/reviewer-session-review.entity"
import { ReviewerGuard } from "./reviewer.guard"
import type { ReviewerSessionViewResult } from "./reviewer.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "./reviewer.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ReviewerGuard)
@RequireContext("organization", "project", "agentSessionInCampaign", "reviewCampaignMembership")
@Controller()
export class ReviewerSessionDetailController {
  constructor(private readonly reviewerService: ReviewerService) {}

  @Get(ReviewCampaignsRoutes.getReviewerSession.path)
  @CheckPolicy((policy) => policy.canView())
  async getReviewerSession(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.getReviewerSession.response> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const result = await this.reviewerService.getSessionForReview({
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
    })
    return { data: toGetReviewerSessionResponseDto(result) }
  }
}

function toGetReviewerSessionResponseDto(
  result: ReviewerSessionViewResult,
): GetReviewerSessionResponseDto {
  const meta = {
    sessionId: result.sessionId,
    agentType: result.agentType,
    testerUserId: result.testerUserId,
    startedAt: result.startedAt.getTime(),
    agent: result.agent,
    transcript: result.transcript.map(toTranscriptMessageDto),
    reviewerQuestions: result.reviewerQuestions,
    otherReviewerCount: result.otherReviewerCount,
    formResult: result.formResult,
  }

  if (result.blind) {
    const blindDto: ReviewerSessionBlindDto = {
      ...meta,
      blind: true,
      factualTesterQuestions: result.factualTesterQuestions,
      factualTesterAnswers: result.factualTesterAnswers,
    }
    return blindDto
  }

  const fullDto: ReviewerSessionFullDto = {
    ...meta,
    blind: false,
    testerPerSessionQuestions: result.testerPerSessionQuestions,
    testerFeedback: result.testerFeedback
      ? {
          overallRating: result.testerFeedback.overallRating,
          comment: result.testerFeedback.comment,
          answers: result.testerFeedback.answers,
        }
      : null,
    myReview: toReviewerSessionReviewDto(result.myReview),
    otherReviews: result.otherReviews.map(toReviewerSessionReviewDto),
  }
  return fullDto
}

function toTranscriptMessageDto(message: AgentMessage): ReviewerSessionTranscriptMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.getTime(),
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
