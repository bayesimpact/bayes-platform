import type {
  ConversationReviewDto,
  ConversationReviewMessageDto,
  ConversationReviewSessionRowDto,
  ExtractionSessionReviewDto,
  PaginatedConversationReviewSessionsDto,
} from "@caseai-connect/api-contracts"

export type ConversationReviewMessage = ConversationReviewMessageDto

export type ConversationReview = ConversationReviewDto

export type ExtractionSessionReview = ExtractionSessionReviewDto

/** One row of the safety review session list, grouped by category. */
export type ConversationReviewSessionRow = ConversationReviewSessionRowDto

/** One page of the safety review session list, grouped by category. */
export type PaginatedConversationReviewSessions = PaginatedConversationReviewSessionsDto

/** The open tab of the safety review screen. */
export type ConversationReviewTab = "session-id" | "by-category"
