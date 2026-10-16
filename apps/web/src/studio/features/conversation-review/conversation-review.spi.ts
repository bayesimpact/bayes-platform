import type { ConversationReview } from "./conversation-review.models"

export interface IConversationReviewSpi {
  getOne(params: {
    organizationId: string
    projectId: string
    agentId: string
    agentSessionId: string
  }): Promise<ConversationReview>
}
