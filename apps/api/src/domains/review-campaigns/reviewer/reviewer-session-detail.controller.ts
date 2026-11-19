import {
  type GetReviewerSessionResponseDto,
  ReviewCampaignsRoutes,
  type ReviewerSessionBlindDto,
  type ReviewerSessionFullDto,
  type ReviewerSessionReviewDto,
  type ReviewerSessionTranscriptMessageDto,
  type ReviewerTranscriptSourceDto,
  ToolName,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgentSessionInCampaign } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewerSessionReview } from "../reviewer-session-reviews/reviewer-session-review.entity"
import type { ReviewerSessionViewResult } from "./reviewer.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "./reviewer.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agentSessionInCampaign")
@Controller()
export class ReviewerSessionDetailController {
  constructor(private readonly reviewerService: ReviewerService) {}

  @Get(ReviewCampaignsRoutes.getReviewerSession.path)
  @CheckPermission(REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION, "review_campaign")
  async getReviewerSession(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
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
    sources: sourcesOf(message),
  }
}

/**
 * The documents a reply relied on, from its `sources` tool calls: the reviewer reads them as the
 * tester did. The other tool calls stay out of the transcript.
 */
function sourcesOf(message: AgentMessage): ReviewerTranscriptSourceDto[] {
  return (message.toolCalls ?? [])
    .filter((toolCall) => toolCall.name === ToolName.Sources)
    .flatMap((toolCall) => {
      const sources = toolCall.arguments.sources
      // The tool's arguments are stored as the model wrote them: keep the well-formed sources.
      return Array.isArray(sources) ? sources.filter(isTranscriptSource) : []
    })
}

function isTranscriptSource(value: unknown): value is ReviewerTranscriptSourceDto {
  if (typeof value !== "object" || value === null) return false
  // Safe: an object whose fields are read and checked one by one just below.
  const source = value as Partial<ReviewerTranscriptSourceDto>
  return typeof source.documentId === "string" && Array.isArray(source.chunks)
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
