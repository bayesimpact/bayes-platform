import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Document } from "@/studio/features/documents/documents.models"
import type { Agent } from "../../agents.models"
import { listAgents } from "../../agents.thunks"
import { patchRunStatus } from "../../csv-extraction-runs/agent-csv-extraction-runs.actions"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"
import { agentCsvExtractionRunsThunks } from "../../csv-extraction-runs/agent-csv-extraction-runs.thunks"
import { patchExtractionSessionStatus } from "./extraction-agent-sessions.actions"
import type { ExtractionAgentSessions } from "./extraction-agent-sessions.models"
import { extractionAgentSessionsThunks } from "./extraction-agent-sessions.thunks"

type DataType = Record<
  Agent["id"],
  {
    isExtracting: boolean
    sessions: AsyncData<ExtractionAgentSessions>
  }
>
interface State {
  data: DataType
  documents: AsyncData<Document[]>
  sessionStatusStream: { isActive: boolean }
}

const initialState: State = {
  data: {},
  documents: defaultAsyncData,
  sessionStatusStream: { isActive: false },
}

function ensureAgentSlot(state: State, agentId: string): DataType[string] {
  if (!state.data[agentId]) {
    // Fresh copy, never the shared frozen `defaultAsyncData` singleton (Immer
    // does not draft freshly-assigned objects).
    state.data[agentId] = { isExtracting: false, sessions: { ...defaultAsyncData } }
  }
  return state.data[agentId]
}

// Insert or replace a CSV run inside its agent's `csvSessions` list.
function upsertCsvRun(state: State, run: AgentCsvExtractionRun) {
  const slot = state.data[run.agentId]
  if (!slot || !ADS.isFulfilled(slot.sessions)) return
  const index = slot.sessions.value.csvSessions.findIndex((session) => session.id === run.id)
  if (index === -1) {
    slot.sessions.value.csvSessions.unshift(run)
  } else {
    slot.sessions.value.csvSessions[index] = run
  }
}

const slice = createSlice({
  name: "extractionAgentSessions",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    sessionMount: () => {},
    sessionUnmount: () => {},
    reset: () => initialState,
    startSessionStatusStream: (state) => {
      state.sessionStatusStream.isActive = true
    },
    stopSessionStatusStream: (state) => {
      state.sessionStatusStream.isActive = false
    },
  },
  extraReducers: (builder) => {
    builder.addCase(listAgents.fulfilled, (state, action) => {
      const extractionAgents = action.payload.filter((agent) => agent.type === "extraction")
      const agentIds = extractionAgents.map((agent) => agent.id)

      // Remove any agent sessions that don't have a corresponding agent anymore
      Object.keys(state.data).forEach((agentId) => {
        if (!agentIds.includes(agentId)) {
          delete state.data[agentId]
        }
      })

      // Initialize state for any new extraction agents
      state.data = extractionAgents.reduce((acc, agent) => {
        acc[agent.id] = state.data[agent.id] || {
          isExtracting: false,
          sessions: { ...defaultAsyncData },
        }
        return acc
      }, {} as DataType)
    })

    builder
      .addCase(extractionAgentSessionsThunks.executeOne.pending, (state, action) => {
        ensureAgentSlot(state, action.meta.arg.agentId).isExtracting = true
      })
      // executeOne now returns immediately with a pending session — keep isExtracting true
      // until the SSE event arrives with a terminal status.
      .addCase(extractionAgentSessionsThunks.executeOne.rejected, (state, action) => {
        ensureAgentSlot(state, action.meta.arg.agentId).isExtracting = false
      })

    builder.addCase(patchExtractionSessionStatus, (state, action) => {
      const { extractionAgentSessionId, agentId, status, updatedAt } = action.payload
      const slot = state.data[agentId]
      if (!slot) return
      if (status === "success" || status === "failed") {
        slot.isExtracting = false
      }
      if (ADS.isFulfilled(slot.sessions)) {
        const session = slot.sessions.value.others.find((s) => s.id === extractionAgentSessionId)
        if (session) {
          session.status = status
          session.updatedAt = updatedAt
        }
      }
    })

    builder
      .addCase(extractionAgentSessionsThunks.listMyDocuments.pending, (state) => {
        state.documents.status = ADS.Loading
        state.documents.error = null
      })
      .addCase(extractionAgentSessionsThunks.listMyDocuments.fulfilled, (state, action) => {
        state.documents.status = ADS.Fulfilled
        state.documents.value = action.payload
      })
      .addCase(extractionAgentSessionsThunks.listMyDocuments.rejected, (state, action) => {
        state.documents.status = ADS.Error
        state.documents.error = action.error.message || "Failed to load documents"
      })

    builder
      .addCase(extractionAgentSessionsThunks.getAll.pending, (state, action) => {
        const slot = ensureAgentSlot(state, action.meta.arg.agentId)
        if (ADS.isFulfilled(slot.sessions)) return
        slot.sessions = { status: ADS.Loading, value: null, error: null }
      })
      .addCase(extractionAgentSessionsThunks.getAll.fulfilled, (state, action) => {
        ensureAgentSlot(state, action.meta.arg.agentId).sessions = {
          status: ADS.Fulfilled,
          value: action.payload,
          error: null,
        }
      })
      .addCase(extractionAgentSessionsThunks.getAll.rejected, (state, action) => {
        ensureAgentSlot(state, action.meta.arg.agentId).sessions = {
          status: ADS.Error,
          value: null,
          error: action.error.message || "Failed to load extraction sessions",
        }
      })

    // Keep the CSV run list in sync with live status updates and run lifecycle
    // actions (the run object is owned by this slice via `csvSessions`).
    builder.addCase(patchRunStatus, (state, action) => {
      const { agentCsvExtractionRunId, status, summary, updatedAt } = action.payload
      for (const slot of Object.values(state.data)) {
        if (!ADS.isFulfilled(slot.sessions)) continue
        const run = slot.sessions.value.csvSessions.find(
          (session) => session.id === agentCsvExtractionRunId,
        )
        if (run) {
          run.status = status
          run.summary = summary
          run.updatedAt = updatedAt
          break
        }
      }
    })

    builder
      .addCase(agentCsvExtractionRunsThunks.createAndExecute.fulfilled, (state, action) => {
        upsertCsvRun(state, action.payload)
      })
      .addCase(agentCsvExtractionRunsThunks.cancelOne.fulfilled, (state, action) => {
        upsertCsvRun(state, action.payload)
      })
      .addCase(agentCsvExtractionRunsThunks.retryOne.fulfilled, (state, action) => {
        upsertCsvRun(state, action.payload)
      })
  },
})

export type { State as ExtractionAgentSessionsState }
export const extractionAgentSessionsInitialState = initialState
export const extractionAgentSessionsActions = { ...slice.actions, ...extractionAgentSessionsThunks }
export const extractionAgentSessionsSlice = slice
