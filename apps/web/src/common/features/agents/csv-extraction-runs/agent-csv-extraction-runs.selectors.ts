import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { selectCurrentExtractionAgentSessionsData } from "../agent-sessions/extraction/extraction-agent-sessions.selectors"
import type {
  AgentCsvExtractionRun,
  PaginatedAgentCsvExtractionRunRecords,
} from "./agent-csv-extraction-runs.models"
import { defaultRecordsQuery } from "./agent-csv-extraction-runs.slice"

const selectData = (state: RootState) => state.agentCsvExtractionRuns.data

const selectCurrentAgentId = (state: RootState) => state.currentIds.agentId

export const selectCurrentCsvRunId = (state: RootState) => state.currentIds.csvRunId

const selectCurrentAgentCsvState = createSelector(
  [selectData, selectCurrentAgentId],
  (data, agentId) => (agentId ? data[agentId] : undefined),
)

const selectCurrentRunState = createSelector(
  [selectCurrentAgentCsvState, selectCurrentCsvRunId],
  (agentState, runId) => (agentState && runId ? agentState.runs[runId] : undefined),
)

export const selectFileColumnsData = createSelector(
  [selectCurrentAgentCsvState],
  (agentState): AsyncData<{ id: string; name: string; values: unknown[] }[]> =>
    agentState?.fileColumns ?? defaultAsyncData,
)

export const selectIsExecutingCsvRun = createSelector(
  [selectCurrentAgentCsvState],
  (agentState) => agentState?.isExecuting ?? false,
)

export const selectCurrentRunRecords = createSelector(
  [selectCurrentRunState],
  (runState): AsyncData<PaginatedAgentCsvExtractionRunRecords> =>
    runState?.records ?? defaultAsyncData,
)

export const selectCurrentCsvRecordsQuery = createSelector(
  [selectCurrentRunState],
  (runState) => runState?.recordsQuery ?? defaultRecordsQuery,
)

export const selectIsCancellingCsvRun = createSelector(
  [selectCurrentRunState],
  (runState) => runState?.isCancelling ?? false,
)

export const selectIsRetryingCsvRun = createSelector(
  [selectCurrentRunState],
  (runState) => runState?.isRetrying ?? false,
)

export const selectIsCsvRunStatusStreamActive = (state: RootState) =>
  state.agentCsvExtractionRuns.runStatusStream.isActive

// The run object lives in the extraction-agent-sessions slice (`csvSessions`),
// so the current run is derived from there by its id.
export const selectCurrentCsvRunData = createSelector(
  [selectCurrentExtractionAgentSessionsData, selectCurrentCsvRunId],
  (sessionsData, runId): AsyncData<AgentCsvExtractionRun> => {
    if (!runId) return defaultAsyncData
    if (ADS.isFulfilled(sessionsData)) {
      const run = sessionsData.value.csvSessions.find((session) => session.id === runId)
      if (!run) return { status: ADS.Error, value: null, error: "CSV extraction run not found" }
      return { status: ADS.Fulfilled, value: run, error: null }
    }
    if (ADS.isError(sessionsData)) {
      return { status: ADS.Error, value: null, error: sessionsData.error ?? "Failed to load run" }
    }
    return { status: ADS.Loading, value: null, error: null }
  },
)

export const selectHasCsvRunsInProgress = createSelector(
  [selectCurrentExtractionAgentSessionsData],
  (sessionsData): boolean => {
    if (!ADS.isFulfilled(sessionsData)) return false
    return sessionsData.value.csvSessions.some(
      (run) => run.status === "pending" || run.status === "running",
    )
  },
)
