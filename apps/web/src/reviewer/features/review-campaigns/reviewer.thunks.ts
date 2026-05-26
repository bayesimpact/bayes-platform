import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type {
  ReviewerCampaign,
  ReviewerSessionDetail,
  ReviewerSessionListItem,
  ReviewerSessionReview,
  SubmitReviewerReviewFields,
  UpdateReviewerReviewFields,
} from "./reviewer.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

type CampaignScopeArg = { organizationId: string; projectId: string; reviewCampaignId: string }
type SessionScopeArg = CampaignScopeArg & { sessionId: string }

export const listMyReviewerCampaigns = createAsyncThunk<ReviewerCampaign[], void, ThunkConfig>(
  "reviewer/listMyCampaigns",
  async (_, { extra: { services } }) => {
    return await services.reviewCampaignsReviewer.listMyCampaigns()
  },
)

export const listReviewerSessions = createAsyncThunk<
  ReviewerSessionListItem[],
  CampaignScopeArg,
  ThunkConfig
>("reviewer/listSessions", async (params, { extra: { services } }) => {
  return await services.reviewCampaignsReviewer.listSessions(params)
})

export const getReviewerSession = createAsyncThunk<
  ReviewerSessionDetail,
  SessionScopeArg,
  ThunkConfig
>("reviewer/getSession", async (params, { extra: { services } }) => {
  return await services.reviewCampaignsReviewer.getSession(params)
})

export const submitReviewerReview = createAsyncThunk<
  ReviewerSessionReview,
  { fields: SubmitReviewerReviewFields },
  ThunkConfig
>("reviewer/submitReview", async ({ fields }, { getState, extra: { services } }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
  const sessionId = getCurrentId({ state, name: "agentSessionId" })
  const scope = { organizationId, projectId, reviewCampaignId, sessionId }
  return await services.reviewCampaignsReviewer.submitReview(scope, fields)
})

export const updateReviewerReview = createAsyncThunk<
  ReviewerSessionReview,
  { reviewId: string; fields: UpdateReviewerReviewFields },
  ThunkConfig
>("reviewer/updateReview", async ({ fields, reviewId }, { getState, extra: { services } }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
  const sessionId = getCurrentId({ state, name: "agentSessionId" })
  const scope = { organizationId, projectId, reviewCampaignId, sessionId, reviewId }
  return await services.reviewCampaignsReviewer.updateReview(scope, fields)
})
