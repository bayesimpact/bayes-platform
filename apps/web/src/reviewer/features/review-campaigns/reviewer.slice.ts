import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  ReviewerCampaign,
  ReviewerSessionDetail,
  ReviewerSessionListItem,
} from "./reviewer.models"
import {
  getReviewerSession,
  listMyReviewerCampaigns,
  listReviewerSessions,
} from "./reviewer.thunks"

interface State {
  campaigns: AsyncData<ReviewerCampaign[]>
  sessions: AsyncData<ReviewerSessionListItem[]>
  sessionDetail: AsyncData<ReviewerSessionDetail>
}

const initialState: State = {
  campaigns: defaultAsyncData,
  sessions: defaultAsyncData,
  sessionDetail: defaultAsyncData,
}

const slice = createSlice({
  name: "reviewCampaignsReviewer",
  initialState,
  reducers: {
    reset: () => initialState,
    mount: () => {},
    unmount: () => {},
    campaignMount: () => {},
    campaignUnmount: () => {},
    sessionMount: () => {},
    sessionUnmount: () => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(listMyReviewerCampaigns.pending, (state) => {
        if (!ADS.isFulfilled(state.campaigns)) state.campaigns.status = ADS.Loading
        state.campaigns.error = null
      })
      .addCase(listMyReviewerCampaigns.fulfilled, (state, action) => {
        state.campaigns = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listMyReviewerCampaigns.rejected, (state, action) => {
        state.campaigns.status = ADS.Error
        state.campaigns.error = action.error.message || "Failed to list campaigns"
      })

    builder
      .addCase(listReviewerSessions.pending, (state) => {
        state.sessions.status = ADS.Loading
        state.sessions.error = null
      })
      .addCase(listReviewerSessions.fulfilled, (state, action) => {
        state.sessions = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listReviewerSessions.rejected, (state, action) => {
        state.sessions = {
          status: ADS.Error,
          error: action.error.message || "Failed to list sessions",
          value: null,
        }
      })

    builder
      .addCase(getReviewerSession.pending, (state) => {
        state.sessionDetail = {
          status: ADS.Loading,
          error: null,
          value: null,
        }
      })
      .addCase(getReviewerSession.fulfilled, (state, action) => {
        state.sessionDetail = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(getReviewerSession.rejected, (state, action) => {
        state.sessionDetail = {
          status: ADS.Error,
          error: action.error.message || "Failed to load session",
          value: null,
        }
      })
  },
})

export type { State as ReviewCampaignsReviewerState }
export const reviewCampaignsReviewerInitialState = initialState
export const reviewCampaignsReviewerActions = { ...slice.actions }
export const reviewCampaignsReviewerSlice = slice
