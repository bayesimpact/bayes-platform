import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../agents.models"
import type { AgentSettings } from "./agent-settings.models"
import { listAgentSettings } from "./agent-settings.thunks"

type DataType = Record<Agent["id"], AsyncData<AgentSettings[]>> // keyed by agentId

interface State {
  history: DataType
  /**
   * Version the playground runs, per session. Deliberately not persisted: a reload starts over
   * from the draft-first default, which is the version a tester wants nine times out of ten.
   */
  playgroundRevisionByAgentId: Record<string, number>
}

const initialState: State = {
  history: {},
  playgroundRevisionByAgentId: {},
}

const slice = createSlice({
  name: "agentSettings",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    setPlaygroundRevision: (
      state,
      action: PayloadAction<{ agentId: string; revision: number }>,
    ) => {
      state.playgroundRevisionByAgentId[action.payload.agentId] = action.payload.revision
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgentSettings.pending, (state, action) => {
        const agentId = action.meta.arg.agentId
        if (!state.history[agentId])
          state.history[agentId] = {
            status: ADS.Loading,
            value: null,
            error: null,
          }
      })
      .addCase(listAgentSettings.fulfilled, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.history[agentId] = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAgentSettings.rejected, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.history[agentId] = {
          status: ADS.Error,
          value: null,
          error: action.error.message || "Failed to load agent version history",
        }
      })
  },
})

export type { State as AgentSettingsState }
export const agentSettingsInitialState = initialState
export const agentSettingsActions = { ...slice.actions }
export const agentSettingsSlice = slice
