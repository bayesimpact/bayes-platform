import type {
  ConversationReview,
  PaginatedConversationReviewSessions,
} from "./conversation-review.models"

export interface IConversationReviewSpi {
  getOne(params: {
    organizationId: string
    projectId: string
    agentId: string
    agentSessionId: string
  }): Promise<ConversationReview>
  /**
   * The safety review session list, one category at a time: `categoryId` is the category, or
   * null for the sessions no category tagged.
   */
  listSessionsByCategory(params: {
    organizationId: string
    projectId: string
    agentId: string
    categoryId: string | null
    page: number
    limit: number
  }): Promise<PaginatedConversationReviewSessions>
}
