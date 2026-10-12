import type { RootState } from "@/common/store"

export const selectConversationReview = (state: RootState) => state.conversationReview.review
