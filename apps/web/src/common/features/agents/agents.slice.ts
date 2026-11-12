import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Agent, AgentModelsCatalog } from "./agents.models"
import { listAgents, listAvailableModels } from "./agents.thunks"

interface State {
  data: AsyncData<Agent[]>
  /** The last list request sent: an older answer that arrives after it is stale. */
  latestListRequestId: string | null
  /** The model catalog of the current project, loaded by the routes that read it. */
  availableModels: AsyncData<AgentModelsCatalog>
}

const initialState: State = {
  data: defaultAsyncData,
  latestListRequestId: null,
  availableModels: defaultAsyncData,
}

const slice = createSlice({
  name: "agents",
  initialState,
  reducers: {
    reset: () => initialState,
    mountAvailableModels: () => {},
    unmountAvailableModels: () => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgents.pending, (state, action) => {
        state.latestListRequestId = action.meta.requestId
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgents.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAgents.rejected, (state, action) => {
        // The thunk rejects a stale answer: only the latest request sets the state.
        if (action.meta.requestId !== state.latestListRequestId) return
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list agents"
      })
      .addCase(listAvailableModels.pending, (state) => {
        if (!ADS.isFulfilled(state.availableModels)) state.availableModels.status = ADS.Loading
        state.availableModels.error = null
      })
      .addCase(listAvailableModels.fulfilled, (state, action) => {
        state.availableModels = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listAvailableModels.rejected, (state, action) => {
        state.availableModels.status = ADS.Error
        state.availableModels.error = action.error.message || "Failed to list available models"
      })
  },
})

export type { State as AgentsState }
export const agentsInitialState = initialState
export const agentsActions = { ...slice.actions }
export const agentsSlice = slice
