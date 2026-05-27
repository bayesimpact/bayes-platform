import type { RootState } from "@/common/store"

export const selectReviewerCampaigns = (state: RootState) => state.reviewCampaignsReviewer.campaigns

export const selectReviewerSessions = (state: RootState) => state.reviewCampaignsReviewer.sessions

export const selectReviewerSessionDetail = (state: RootState) =>
  state.reviewCampaignsReviewer.sessionDetail
