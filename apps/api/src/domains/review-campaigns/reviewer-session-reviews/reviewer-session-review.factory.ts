import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAgentType } from "../review-campaigns.types"
import type { ReviewerSessionReview } from "./reviewer-session-review.entity"

type ReviewerSessionReviewTransientParams = RequiredScopeTransientParams & {
  campaign: ReviewCampaign
  session: ConversationAgentSession | ExtractionAgentSession
  agentType: ReviewCampaignAgentType
  reviewerUser: User
}

class ReviewerSessionReviewFactory extends Factory<
  ReviewerSessionReview,
  ReviewerSessionReviewTransientParams
> {}

export const reviewerSessionReviewFactory = ReviewerSessionReviewFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.campaign) {
      throw new Error("campaign transient is required")
    }
    if (!transientParams.session) {
      throw new Error("session transient is required")
    }
    if (!transientParams.agentType) {
      throw new Error("agentType transient is required")
    }
    if (!transientParams.reviewerUser) {
      throw new Error("reviewerUser transient is required")
    }

    const agentType = transientParams.agentType
    const conversationAgentSession =
      agentType === "conversation" ? (transientParams.session as ConversationAgentSession) : null

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      campaignId: transientParams.campaign.id,
      campaign: transientParams.campaign,
      sessionId: transientParams.session.id,
      agentType,
      conversationAgentSession,
      reviewerUserId: transientParams.reviewerUser.id,
      reviewerUser: transientParams.reviewerUser,
      overallRating: params.overallRating ?? 5,
      comment: params.comment ?? null,
      answers: params.answers || [],
      submittedAt: params.submittedAt || now,
    } satisfies ReviewerSessionReview
  },
)
