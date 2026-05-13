import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Document } from "@/studio/features/documents/documents.models"
import type { Agent } from "../../agents.models"
import { listAgentSessionsForAgents } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { ExtractionAgentSessionSummary } from "./extraction-agent-sessions.models"
import { extractionAgentSessionThunks } from "./extraction-agent-sessions.thunks"

type DataType = Record<Agent["id"], ExtractionAgentSessionSummary[]>
interface State {
  data: AsyncData<DataType>
  documents: AsyncData<Document[]>
  isProcesssingExecution: boolean
}

const initialState: State = {
  data: defaultAsyncData,
  documents: defaultAsyncData,
  isProcesssingExecution: false,
}

const slice = createSlice({
  name: "extractionAgentSessions",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(extractionAgentSessionThunks.executeOne.pending, (state) => {
        state.isProcesssingExecution = true
      })
      .addCase(extractionAgentSessionThunks.executeOne.fulfilled, (state) => {
        state.isProcesssingExecution = false
      })
      .addCase(extractionAgentSessionThunks.executeOne.rejected, (state) => {
        state.isProcesssingExecution = false
      })

    builder
      .addCase(extractionAgentSessionThunks.listMyDocuments.pending, (state) => {
        state.documents.status = ADS.Loading
        state.documents.error = null
      })
      .addCase(extractionAgentSessionThunks.listMyDocuments.fulfilled, (state, action) => {
        state.documents.status = ADS.Fulfilled
        state.documents.value = action.payload
      })
      .addCase(extractionAgentSessionThunks.listMyDocuments.rejected, (state, action) => {
        state.documents.status = ADS.Error
        state.documents.error = action.error.message || "Failed to load documents"
      })

    builder
      .addCase(listAgentSessionsForAgents.pending, (state, action) => {
        if (action.meta.arg.agentType !== "extraction") return
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgentSessionsForAgents.fulfilled, (state, action) => {
        if (action.meta.arg.agentType !== "extraction") return
        const sessionsByAgentId = action.payload.reduce((acc, curr) => {
          return Object.assign(acc, curr)
        }, {}) as DataType
        state.data = {
          value: {
            ...state.data.value,
            ...sessionsByAgentId,
          },
          status: ADS.Fulfilled,
          error: null,
        }
      })
      .addCase(listAgentSessionsForAgents.rejected, (state, action) => {
        if (action.meta.arg.agentType !== "extraction") return
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load sessions"
      })
  },
})

export type { State as ExtractionAgentSessionsState }
export const extractionAgentSessionsInitialState = initialState
export const extractionAgentSessionsActions = { ...slice.actions, ...extractionAgentSessionThunks }
export const extractionAgentSessionsSlice = slice
