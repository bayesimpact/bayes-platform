import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentSubAgent } from "./agent-sub-agents.models"
import { agentSubAgentsThunks } from "./agent-sub-agents.thunks"

interface State {
  data: AsyncData<AgentSubAgent[]>
  mounted: boolean
}

const initialState: State = {
  data: defaultAsyncData,
  mounted: false,
}

const slice = createSlice({
  name: "agentSubAgents",
  initialState,
  reducers: {
    mount: (state) => {
      state.mounted = true
    },
    unmount: () => initialState,
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(agentSubAgentsThunks.list.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(agentSubAgentsThunks.list.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(agentSubAgentsThunks.list.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load sub-agents"
      })
  },
})

export type { State as AgentSubAgentsState }
export const agentSubAgentsInitialState = initialState
export const agentSubAgentsActions = { ...slice.actions, ...agentSubAgentsThunks }
export const agentSubAgentsSlice = slice
