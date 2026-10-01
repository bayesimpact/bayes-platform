import type { RootState } from "@/common/store"

export const selectReviewCampaignsData = (state: RootState) => state.reviewCampaigns.data

export const selectReviewCampaignDetail = (state: RootState) => state.reviewCampaigns.selectedDetail

export const selectReviewCampaignPendingInvitations = (state: RootState) =>
  state.reviewCampaigns.pendingInvitations
