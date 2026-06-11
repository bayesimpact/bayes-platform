import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  MyReviewCampaign,
  MyTesterSessionSummary,
  TesterCampaignSurvey,
  TesterContext,
  TesterSessionFeedback,
} from "./tester.models"
import {
  getMyTesterSurvey,
  getTesterContext,
  listMyReviewCampaigns,
  listMyTesterSessions,
} from "./tester.thunks"

interface State {
  myCampaigns: AsyncData<MyReviewCampaign[]>
  testerContext: AsyncData<TesterContext>
  campaignSurvey: AsyncData<TesterCampaignSurvey | null>
  campaignSessions: AsyncData<MyTesterSessionSummary[]>
  campaignSessionFeedback: AsyncData<TesterSessionFeedback>
}

const initialState: State = {
  myCampaigns: defaultAsyncData,
  testerContext: defaultAsyncData,
  campaignSessionFeedback: defaultAsyncData,
  campaignSurvey: defaultAsyncData,
  campaignSessions: defaultAsyncData,
}

const slice = createSlice({
  name: "reviewCampaignsTester",
  initialState,
  reducers: {
    reset: () => initialState,
    campaignsMount: () => {},
    campaignsUnmount: () => {},
    campaignMount: () => {},
    campaignUnmount: () => {},
    sessionMount: () => {},
    sessionUnmount: () => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(listMyReviewCampaigns.pending, (state) => {
        if (!ADS.isFulfilled(state.myCampaigns)) state.myCampaigns.status = ADS.Loading
        state.myCampaigns.error = null
      })
      .addCase(listMyReviewCampaigns.fulfilled, (state, action) => {
        state.myCampaigns = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listMyReviewCampaigns.rejected, (state, action) => {
        state.myCampaigns.status = ADS.Error
        state.myCampaigns.error = action.error.message || "Failed to list review campaigns"
      })

    builder
      .addCase(getTesterContext.pending, (state) => {
        if (!ADS.isFulfilled(state.testerContext)) state.testerContext.status = ADS.Loading
        state.testerContext.error = null
      })
      .addCase(getTesterContext.fulfilled, (state, action) => {
        state.testerContext = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(getTesterContext.rejected, (state, action) => {
        state.testerContext.status = ADS.Error
        state.testerContext.error = action.error.message || "Failed to load campaign context"
      })

    builder
      .addCase(listMyTesterSessions.pending, (state) => {
        const sessions = state.campaignSessions
        if (!sessions || !ADS.isFulfilled(sessions)) {
          state.campaignSessions = {
            status: ADS.Loading,
            error: null,
            value: null,
          }
        }
      })
      .addCase(listMyTesterSessions.fulfilled, (state, action) => {
        state.campaignSessions = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listMyTesterSessions.rejected, (state, action) => {
        state.campaignSessions = {
          status: ADS.Error,
          error: action.error.message || "Failed to list tester sessions",
          value: null,
        }
      })

    builder
      .addCase(getMyTesterSurvey.pending, (state) => {
        if (!ADS.isFulfilled(state.campaignSurvey)) {
          state.campaignSurvey = {
            status: ADS.Loading,
            error: null,
            value: null,
          }
        }
      })
      .addCase(getMyTesterSurvey.fulfilled, (state, action) => {
        state.campaignSurvey = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(getMyTesterSurvey.rejected, (state) => {
        state.campaignSurvey = {
          status: ADS.Error,
          error: "Failed to get tester survey",
          value: null,
        }
      })
  },
})

export type { State as ReviewCampaignsTesterState }
export const reviewCampaignsTesterInitialState = initialState
export const reviewCampaignsTesterActions = { ...slice.actions }
export const reviewCampaignsTesterSlice = slice
