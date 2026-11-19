import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../agents.models"
import type { AgentSettings } from "./agent-settings.models"
import { listAgentSettingsWithDraft, restoreAgentSettings } from "./agent-settings.thunks"

type DataType = Record<Agent["id"], AsyncData<AgentSettings[]>> // keyed by agentId

interface State {
  history: DataType
  /**
   * Version the user picked for the playground, per agent. It holds for the session open: a new
   * chat or another session starts over from the newest version, the draft or else the newest
   * saved one. Deliberately not persisted: a reload starts over from that default too.
   */
  playgroundRevisionByAgentId: Record<string, number>
  /**
   * Number of versions restored since the app started. The agent editor keys its forms on it:
   * a restore replaces the settings under the forms, so they must reload. The editor's own
   * saves do not change it, so typing is never interrupted by a reload.
   */
  restoreCount: number
  /**
   * The last history request sent per agent. The editor reloads the history after each of its
   * saves: an older answer that comes back last must not replace a newer one.
   */
  latestHistoryRequestId: Record<Agent["id"], string>
}

const initialState: State = {
  history: {},
  playgroundRevisionByAgentId: {},
  restoreCount: 0,
  latestHistoryRequestId: {},
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
    resetPlaygroundRevisions: (state) => {
      state.playgroundRevisionByAgentId = {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreAgentSettings.fulfilled, (state) => {
        state.restoreCount += 1
      })
      .addCase(listAgentSettingsWithDraft.pending, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.latestHistoryRequestId[agentId] = action.meta.requestId
        if (!state.history[agentId])
          state.history[agentId] = {
            status: ADS.Loading,
            value: null,
            error: null,
          }
      })
      .addCase(listAgentSettingsWithDraft.fulfilled, (state, action) => {
        const agentId = action.meta.arg.agentId
        if (state.latestHistoryRequestId[agentId] !== action.meta.requestId) return
        state.history[agentId] = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAgentSettingsWithDraft.rejected, (state, action) => {
        const agentId = action.meta.arg.agentId
        if (state.latestHistoryRequestId[agentId] !== action.meta.requestId) return
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
