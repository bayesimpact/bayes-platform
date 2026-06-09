import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../agents.models"
import { patchRunStatus } from "./agent-csv-extraction-runs.actions"
import type {
  AgentCsvExtractionRun,
  PaginatedAgentCsvExtractionRunRecords,
} from "./agent-csv-extraction-runs.models"
import { agentCsvExtractionRunsThunks } from "./agent-csv-extraction-runs.thunks"

export interface RecordsQuery {
  page: number
  limit: number
  columnFilters?: Record<string, string>
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

// Per-run UI sub-state. The run object itself (status/summary/dates) lives in the
// extraction-agent-sessions slice (`csvSessions`), so it is intentionally absent here.
interface RunState {
  records: AsyncData<PaginatedAgentCsvExtractionRunRecords>
  recordsQuery: RecordsQuery
  isRetrying: boolean
  isCancelling: boolean
}

// Per-agent state. `fileColumns` and `isExecuting` belong to the pre-run CSV
// configuration flow (only a documentId exists at that point, no runId yet).
interface AgentState {
  fileColumns: AsyncData<{ id: string; name: string; values: unknown[] }[]>
  isExecuting: boolean
  runs: Record<AgentCsvExtractionRun["id"], RunState>
}

type DataType = Record<Agent["id"], AgentState>

interface State {
  data: DataType
  runStatusStream: { isActive: boolean }
}

export const defaultRecordsQuery: RecordsQuery = { page: 0, limit: 10 }

const initialState: State = {
  data: {},
  runStatusStream: { isActive: false },
}

function ensureAgentState(state: State, agentId: string): AgentState {
  if (!state.data[agentId]) {
    // Fresh copies, never the shared frozen `defaultAsyncData` singleton — Immer
    // does not draft freshly-assigned objects, so mutating a frozen nested value
    // would throw "Cannot assign to read only property".
    state.data[agentId] = { fileColumns: { ...defaultAsyncData }, isExecuting: false, runs: {} }
  }
  return state.data[agentId]
}

function ensureRunState(state: State, agentId: string, runId: string): RunState {
  const agentState = ensureAgentState(state, agentId)
  if (!agentState.runs[runId]) {
    agentState.runs[runId] = {
      records: { ...defaultAsyncData },
      recordsQuery: { ...defaultRecordsQuery },
      isRetrying: false,
      isCancelling: false,
    }
  }
  return agentState.runs[runId]
}

const slice = createSlice({
  name: "agentCsvExtractionRuns",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    startRunStatusStream: (state) => {
      state.runStatusStream.isActive = true
    },
    stopRunStatusStream: (state) => {
      state.runStatusStream.isActive = false
    },
  },
  extraReducers: (builder) => {
    // getRecords
    builder
      .addCase(agentCsvExtractionRunsThunks.getRecords.pending, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        const runState = ensureRunState(state, agentId, agentCsvExtractionRunId)
        if (!ADS.isFulfilled(runState.records)) runState.records.status = ADS.Loading
        runState.records.error = null
        runState.recordsQuery = {
          page: action.meta.arg.page ?? 0,
          limit: action.meta.arg.limit ?? 10,
          columnFilters: action.meta.arg.columnFilters,
          sortBy: action.meta.arg.sortBy,
          sortOrder: action.meta.arg.sortOrder,
        }
      })
      .addCase(agentCsvExtractionRunsThunks.getRecords.fulfilled, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        const runState = ensureRunState(state, agentId, agentCsvExtractionRunId)
        runState.records = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(agentCsvExtractionRunsThunks.getRecords.rejected, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        const runState = ensureRunState(state, agentId, agentCsvExtractionRunId)
        runState.records.status = ADS.Error
        runState.records.error = action.error.message || "Failed to get run records"
      })

    // getFileColumns
    builder
      .addCase(agentCsvExtractionRunsThunks.getFileColumns.pending, (state, action) => {
        const agentState = ensureAgentState(state, action.meta.arg.agentId)
        agentState.fileColumns.status = ADS.Loading
        agentState.fileColumns.error = null
      })
      .addCase(agentCsvExtractionRunsThunks.getFileColumns.fulfilled, (state, action) => {
        const agentState = ensureAgentState(state, action.meta.arg.agentId)
        agentState.fileColumns = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(agentCsvExtractionRunsThunks.getFileColumns.rejected, (state, action) => {
        const agentState = ensureAgentState(state, action.meta.arg.agentId)
        agentState.fileColumns.status = ADS.Error
        agentState.fileColumns.error = action.error.message || "Failed to get file columns"
      })

    // createAndExecute
    builder
      .addCase(agentCsvExtractionRunsThunks.createAndExecute.pending, (state, action) => {
        ensureAgentState(state, action.meta.arg.agentId).isExecuting = true
      })
      .addCase(agentCsvExtractionRunsThunks.createAndExecute.fulfilled, (state, action) => {
        ensureAgentState(state, action.meta.arg.agentId).isExecuting = false
      })
      .addCase(agentCsvExtractionRunsThunks.createAndExecute.rejected, (state, action) => {
        ensureAgentState(state, action.meta.arg.agentId).isExecuting = false
      })

    // retryOne
    builder
      .addCase(agentCsvExtractionRunsThunks.retryOne.pending, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isRetrying = true
      })
      .addCase(agentCsvExtractionRunsThunks.retryOne.fulfilled, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isRetrying = false
      })
      .addCase(agentCsvExtractionRunsThunks.retryOne.rejected, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isRetrying = false
      })

    // cancelOne
    builder
      .addCase(agentCsvExtractionRunsThunks.cancelOne.pending, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isCancelling = true
      })
      .addCase(agentCsvExtractionRunsThunks.cancelOne.fulfilled, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isCancelling = false
      })
      .addCase(agentCsvExtractionRunsThunks.cancelOne.rejected, (state, action) => {
        const { agentId, agentCsvExtractionRunId } = action.meta.arg
        ensureRunState(state, agentId, agentCsvExtractionRunId).isCancelling = false
      })
  },
})

export type { State as AgentCsvExtractionRunsState }
export const agentCsvExtractionRunsInitialState = initialState
export const agentCsvExtractionRunsActions = {
  ...slice.actions,
  patchRunStatus,
  ...agentCsvExtractionRunsThunks,
}
export const agentCsvExtractionRunsSlice = slice
