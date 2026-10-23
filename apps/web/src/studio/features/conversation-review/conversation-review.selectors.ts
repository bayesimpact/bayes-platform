import type { RootState } from "@/common/store"

export const selectConversationReview = (state: RootState) => state.conversationReview.review

export const selectConversationReviewTab = (state: RootState) => state.conversationReview.reviewTab

export const selectConversationReviewSessions = (state: RootState) =>
  state.conversationReview.sessions

export const selectConversationReviewSessionsCategoryId = (state: RootState) =>
  state.conversationReview.sessionsCategoryId

export const selectConversationReviewSelectedSessionId = (state: RootState) =>
  state.conversationReview.selectedSessionId
