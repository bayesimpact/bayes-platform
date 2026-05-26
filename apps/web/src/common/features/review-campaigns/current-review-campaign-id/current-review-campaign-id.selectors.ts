import type { RootState } from "@/common/store"

export const selectCurrentReviewCampaignId = (state: RootState) => state.currentIds.reviewCampaignId

export const hasReviewCampaignIdChanged = (originalState: RootState, currentState: RootState) => {
  if (!originalState.currentIds || !currentState.currentIds) return false
  const prevId = selectCurrentReviewCampaignId(originalState)
  const nextId = selectCurrentReviewCampaignId(currentState)
  return prevId !== nextId
}
