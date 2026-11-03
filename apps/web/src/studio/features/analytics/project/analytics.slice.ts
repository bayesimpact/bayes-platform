import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { AnalyticsDailyPoint } from "./analytics.models"
import { loadProjectAnalytics } from "./analytics.thunks"

interface State {
  conversationsPerDay: AsyncData<AnalyticsDailyPoint[]>
  avgUserQuestionsPerSessionPerDay: AsyncData<AnalyticsDailyPoint[]>
  emptySessionsPerDay: AsyncData<AnalyticsDailyPoint[]>
}

const emptySeries: AsyncData<AnalyticsDailyPoint[]> = {
  status: ADS.Uninitialized,
  error: null,
  value: null,
}

const initialState: State = {
  conversationsPerDay: { ...emptySeries },
  avgUserQuestionsPerSessionPerDay: { ...emptySeries },
  emptySessionsPerDay: { ...emptySeries },
}

const slice = createSlice({
  name: "projectAnalytics",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProjectAnalytics.pending, (state) => {
        if (!ADS.isFulfilled(state.conversationsPerDay)) {
          state.conversationsPerDay.status = ADS.Loading
        }
        if (!ADS.isFulfilled(state.avgUserQuestionsPerSessionPerDay)) {
          state.avgUserQuestionsPerSessionPerDay.status = ADS.Loading
        }
        if (!ADS.isFulfilled(state.emptySessionsPerDay)) {
          state.emptySessionsPerDay.status = ADS.Loading
        }
        state.conversationsPerDay.error = null
        state.avgUserQuestionsPerSessionPerDay.error = null
        state.emptySessionsPerDay.error = null
      })
      .addCase(loadProjectAnalytics.fulfilled, (state, action) => {
        state.conversationsPerDay = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.conversationsPerDay,
        }
        state.avgUserQuestionsPerSessionPerDay = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.avgUserQuestionsPerSessionPerDay,
        }
        state.emptySessionsPerDay = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.emptySessionsPerDay,
        }
      })
      .addCase(loadProjectAnalytics.rejected, (state, action) => {
        const message = action.error.message || "Failed to load analytics"
        state.conversationsPerDay = {
          status: ADS.Error,
          error: message,
          value: null,
        }
        state.avgUserQuestionsPerSessionPerDay = {
          status: ADS.Error,
          error: message,
          value: null,
        }
        state.emptySessionsPerDay = {
          status: ADS.Error,
          error: message,
          value: null,
        }
      })
  },
})

export type { State as ProjectAnalyticsState }
export const projectAnalyticsInitialState = initialState
export const projectAnalyticsActions = { ...slice.actions }
export const projectAnalyticsSlice = slice
