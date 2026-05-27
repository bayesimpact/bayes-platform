import { createSelector } from "@reduxjs/toolkit"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import type { RootState } from "@/common/store"
import { type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { CampaignReport } from "./reports.models"

const reportsState = (state: RootState) => state.reviewCampaignsReports

export const selectCurrentCampaignReport = createSelector(
  [selectCurrentReviewCampaignId, reportsState],
  (campaignId, reports): AsyncData<CampaignReport> => {
    if (!campaignId) return defaultAsyncData
    return reports.report
  },
)
