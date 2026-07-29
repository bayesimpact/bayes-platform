import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentSettings } from "./agent-settings.models"
import { listAgentSettings } from "./agent-settings.thunks"

interface State {
  agentId: string | null
  data: AsyncData<AgentSettings[]>
}

const initialState: State = {
  agentId: null,
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentSettings",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgentSettings.pending, (state, action) => {
        state.agentId = action.meta.arg.agentId
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgentSettings.fulfilled, (state, action) => {
        // A slower, stale request for a previously selected agent can resolve after a newer one
        // was already dispatched. Drop it so it does not overwrite the current agent's data.
        if (action.meta.arg.agentId !== state.agentId) return
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAgentSettings.rejected, (state, action) => {
        if (action.meta.arg.agentId !== state.agentId) return
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load agent settings"
      })
  },
})

export type { State as AgentSettingsState }
export const agentSettingsInitialState = initialState
export const agentSettingsActions = { ...slice.actions }
export const agentSettingsSlice = slice
