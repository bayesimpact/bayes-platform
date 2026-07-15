import { createSlice } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { listAgentHistory } from "./agent-history.thunks"

interface State {
  data: AsyncData<Agent[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentHistory",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgentHistory.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgentHistory.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAgentHistory.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load agent version history"
      })
  },
})

export type { State as AgentHistoryState }
export const agentHistoryInitialState = initialState
export const agentHistoryActions = { ...slice.actions }
export const agentHistorySlice = slice
