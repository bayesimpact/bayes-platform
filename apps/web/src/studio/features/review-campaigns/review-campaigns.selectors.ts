import type { RootState } from "@/common/store"

export const selectReviewCampaignsStatus = (state: RootState) =>
  state.studio.reviewCampaigns.data.status

export const selectReviewCampaignsError = (state: RootState) =>
  state.studio.reviewCampaigns.data.error

export const selectReviewCampaignsData = (state: RootState) => state.studio.reviewCampaigns.data

export const selectReviewCampaignDetail = (state: RootState) =>
  state.studio.reviewCampaigns.selectedDetail

export const selectReviewCampaignPendingInvitations = (state: RootState) =>
  state.studio.reviewCampaigns.pendingInvitations
