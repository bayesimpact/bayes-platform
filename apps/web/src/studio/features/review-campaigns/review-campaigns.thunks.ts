import type {
  CreateReviewCampaignRequestDto,
  UpdateReviewCampaignRequestDto,
} from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type {
  ReviewCampaign,
  ReviewCampaignDetail,
  ReviewCampaignListItem,
} from "./review-campaigns.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listReviewCampaigns = createAsyncThunk<ReviewCampaignListItem[], void, ThunkConfig>(
  "review-campaigns/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.reviewCampaigns.getAll(params)
  },
)

export const getReviewCampaignDetail = createAsyncThunk<
  ReviewCampaignDetail,
  { reviewCampaignId: string },
  ThunkConfig
>("review-campaigns/get", async ({ reviewCampaignId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.reviewCampaigns.getOne({ organizationId, projectId, reviewCampaignId })
})

export const createReviewCampaign = createAsyncThunk<
  ReviewCampaign,
  { fields: CreateReviewCampaignRequestDto },
  ThunkConfig
>("review-campaigns/create", async ({ fields }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.reviewCampaigns.createOne({ organizationId, projectId }, fields)
})

export const updateReviewCampaign = createAsyncThunk<
  ReviewCampaign,
  { reviewCampaignId: string; fields: UpdateReviewCampaignRequestDto },
  ThunkConfig
>(
  "review-campaigns/update",
  async ({ reviewCampaignId, fields }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.reviewCampaigns.updateOne(
      { organizationId, projectId, reviewCampaignId },
      fields,
    )
  },
)

export const deleteReviewCampaign = createAsyncThunk<
  void,
  { reviewCampaignId: string },
  ThunkConfig
>("review-campaigns/delete", async ({ reviewCampaignId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  await services.reviewCampaigns.deleteOne({ organizationId, projectId, reviewCampaignId })
})

export const revokeReviewCampaignMembership = createAsyncThunk<
  void,
  { reviewCampaignId: string; membershipId: string },
  ThunkConfig
>(
  "review-campaigns/revoke",
  async ({ reviewCampaignId, membershipId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.reviewCampaigns.revokeMembership({
      organizationId,
      projectId,
      reviewCampaignId,
      membershipId,
    })
  },
)
