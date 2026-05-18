import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { listInvitationsForTarget } from "@/studio/features/invitations/invitations.thunks"
import type { ReviewCampaignDetail, ReviewCampaignListItem } from "./review-campaigns.models"
import { getReviewCampaignDetail, listReviewCampaigns } from "./review-campaigns.thunks"

interface State {
  data: AsyncData<ReviewCampaignListItem[]>
  selectedDetail: AsyncData<ReviewCampaignDetail>
  pendingInvitations: AsyncData<PendingInvitations>
}

const initialState: State = {
  data: defaultAsyncData,
  selectedDetail: defaultAsyncData,
  pendingInvitations: defaultAsyncData,
}

const slice = createSlice({
  name: "reviewCampaigns",
  initialState,
  reducers: {
    reset: () => initialState,
    clearSelectedDetail: (state) => {
      state.selectedDetail = defaultAsyncData
    },
    /**
     * Marker action dispatched by `CampaignEditorSheet` when it opens in
     * edit mode. The studio review-campaigns listener middleware reacts by
     * dispatching `getReviewCampaignDetail`. Lets the sheet stay free of
     * fetch-on-mount useEffects (see `apps/web/CLAUDE.md`).
     */
    selectDetail: (_state, _action: PayloadAction<{ reviewCampaignId: string }>) => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(listReviewCampaigns.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listReviewCampaigns.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: [...action.payload].sort((a, b) => b.createdAt - a.createdAt),
        }
      })
      .addCase(listReviewCampaigns.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list review campaigns"
      })
      .addCase(getReviewCampaignDetail.pending, (state) => {
        if (!ADS.isFulfilled(state.selectedDetail)) {
          state.selectedDetail.status = ADS.Loading
        }
        state.selectedDetail.error = null
      })
      .addCase(getReviewCampaignDetail.fulfilled, (state, action) => {
        state.selectedDetail = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(getReviewCampaignDetail.rejected, (state, action) => {
        state.selectedDetail.status = ADS.Error
        state.selectedDetail.error = action.error.message || "Failed to load review campaign detail"
      })
      .addCase(listInvitationsForTarget.pending, (state, action) => {
        if (action.meta.arg.targetType !== "review_campaign") return
        if (!ADS.isFulfilled(state.pendingInvitations)) {
          state.pendingInvitations.status = ADS.Loading
        }
        state.pendingInvitations.error = null
      })
      .addCase(listInvitationsForTarget.fulfilled, (state, action) => {
        if (action.meta.arg.targetType !== "review_campaign") return
        state.pendingInvitations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listInvitationsForTarget.rejected, (state, action) => {
        if (action.meta.arg.targetType !== "review_campaign") return
        state.pendingInvitations.status = ADS.Error
        state.pendingInvitations.error =
          action.error.message || "Failed to list review campaign pending invitations"
      })
  },
})

export type { State as ReviewCampaignsState }
export const reviewCampaignsInitialState = initialState
export const reviewCampaignsActions = { ...slice.actions }
export const reviewCampaignsSlice = slice
