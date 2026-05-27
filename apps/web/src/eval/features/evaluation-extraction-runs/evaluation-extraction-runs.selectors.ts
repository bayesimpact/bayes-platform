import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { EvaluationExtractionRun } from "./evaluation-extraction-runs.models"

export const selectEvaluationExtractionRunsData = (state: RootState) => state.extractionRuns.data

export const selectCurrentRunId = (state: RootState) => state.currentIds.runId

export const selectCurrentRunData = (state: RootState) => state.extractionRuns.currentRun

export const selectCurrentRunRecords = (state: RootState) => state.extractionRuns.currentRunRecords

export const selectIsExecuting = (state: RootState) => state.extractionRuns.isExecuting

export const selectIsCancelling = (state: RootState) => state.extractionRuns.isCancelling
export const selectIsRetrying = (state: RootState) => state.extractionRuns.isRetrying

export const selectCurrentRecordsQuery = (state: RootState) =>
  state.extractionRuns.currentRecordsQuery

export const selectIsRunStatusStreamActive = (state: RootState) =>
  state.extractionRuns.runStatusStream.isActive

export const selectHasRunsInProgress = createSelector(
  [selectEvaluationExtractionRunsData, selectCurrentRunData],
  (runsData, currentRunData): boolean => {
    if (ADS.isFulfilled(currentRunData)) {
      const { status } = currentRunData.value
      if (status === "pending" || status === "running") return true
    }
    if (ADS.isFulfilled(runsData)) {
      return runsData.value.some((run) => run.status === "pending" || run.status === "running")
    }
    return false
  },
)

export const selectRunsForDataset = createSelector(
  [selectEvaluationExtractionRunsData, (_state: RootState, datasetId: string) => datasetId],
  (runsData, datasetId): AsyncData<EvaluationExtractionRun[]> => {
    if (ADS.isFulfilled(runsData)) {
      const filtered = runsData.value.filter(
        (run) => run.evaluationExtractionDatasetId === datasetId,
      )
      return { status: ADS.Fulfilled, error: null, value: filtered }
    }
    return runsData
  },
)
