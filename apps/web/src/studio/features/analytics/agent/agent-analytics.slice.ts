import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "../project/analytics.models"
import { loadAgentAnalytics } from "./agent-analytics.thunks"

interface State {
  conversationsPerDay: AsyncData<AnalyticsDailyPoint[]>
  avgUserQuestionsPerSessionPerDay: AsyncData<AnalyticsDailyPoint[]>
  conversationsByCategoryPerDay: AsyncData<AnalyticsCategoryDailyPoint[]>
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
  conversationsByCategoryPerDay: { ...emptySeries },
  emptySessionsPerDay: { ...emptySeries },
}

const slice = createSlice({
  name: "agentAnalytics",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAgentAnalytics.pending, (state) => {
        if (!ADS.isFulfilled(state.conversationsPerDay)) {
          state.conversationsPerDay.status = ADS.Loading
        }
        if (!ADS.isFulfilled(state.avgUserQuestionsPerSessionPerDay)) {
          state.avgUserQuestionsPerSessionPerDay.status = ADS.Loading
        }
        if (!ADS.isFulfilled(state.conversationsByCategoryPerDay)) {
          state.conversationsByCategoryPerDay.status = ADS.Loading
        }
        if (!ADS.isFulfilled(state.emptySessionsPerDay)) {
          state.emptySessionsPerDay.status = ADS.Loading
        }
        state.conversationsPerDay.error = null
        state.avgUserQuestionsPerSessionPerDay.error = null
        state.conversationsByCategoryPerDay.error = null
        state.emptySessionsPerDay.error = null
      })
      .addCase(loadAgentAnalytics.fulfilled, (state, action) => {
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
        state.conversationsByCategoryPerDay = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.conversationsByCategoryPerDay,
        }
        state.emptySessionsPerDay = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.emptySessionsPerDay,
        }
      })
      .addCase(loadAgentAnalytics.rejected, (state, action) => {
        const message = action.error.message || "Failed to load agent analytics"
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
        state.conversationsByCategoryPerDay = {
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

export type { State as AgentAnalyticsState }
export const agentAnalyticsInitialState = initialState
export const agentAnalyticsActions = { ...slice.actions }
export const agentAnalyticsSlice = slice
