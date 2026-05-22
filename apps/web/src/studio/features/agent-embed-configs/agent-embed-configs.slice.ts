import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentEmbedConfig } from "./agent-embed-configs.models"
import { agentEmbedConfigsThunks } from "./agent-embed-configs.thunks"

interface State {
  data: AsyncData<AgentEmbedConfig>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentEmbedConfigs",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(agentEmbedConfigsThunks.fetchConfig.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(agentEmbedConfigsThunks.fetchConfig.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(agentEmbedConfigsThunks.fetchConfig.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load embed config"
      })

    builder.addCase(agentEmbedConfigsThunks.updateConfig.fulfilled, (state, action) => {
      if (ADS.isFulfilled(state.data)) {
        state.data.value = {
          ...state.data.value,
          isEnabled: action.meta.arg.isEnabled,
          allowedOrigins: action.meta.arg.allowedOrigins,
        }
      }
    })
  },
})

export type { State as AgentEmbedConfigsState }
export const agentEmbedConfigsInitialState = initialState
export const agentEmbedConfigsActions = { ...slice.actions, ...agentEmbedConfigsThunks }
export const agentEmbedConfigsSlice = slice
