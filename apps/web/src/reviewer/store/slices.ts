import { createSliceManager } from "@/common/store/dynamic-middleware"
import { reviewCampaignsReportsMiddleware } from "@/studio/features/review-campaigns/reports/reports.middleware"
import { reviewCampaignsReportsSlice } from "@/studio/features/review-campaigns/reports/reports.slice"
import { reviewCampaignsTesterSlice } from "@/tester/features/review-campaigns/tester.slice"
import { reviewCampaignsReviewerMiddleware } from "../features/review-campaigns/reviewer.middleware"
import { reviewCampaignsReviewerSlice } from "../features/review-campaigns/reviewer.slice"
import { currentIdsSlice } from "./currentIds.slice"

const reviewerMiddlewareList = [reviewCampaignsReviewerMiddleware, reviewCampaignsReportsMiddleware]

export const reviewerSliceList = [
  currentIdsSlice,
  reviewCampaignsReviewerSlice,
  reviewCampaignsTesterSlice,
  reviewCampaignsReportsSlice,
]

export const { injectSlices: injectReviewerSlices, resetSlices: resetReviewerSlices } =
  createSliceManager({
    middlewares: reviewerMiddlewareList,
    slices: reviewerSliceList,
  })
