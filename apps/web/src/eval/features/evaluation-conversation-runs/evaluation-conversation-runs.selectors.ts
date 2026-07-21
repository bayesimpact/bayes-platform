import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { EvaluationConversationRun } from "./evaluation-conversation-runs.models"

export const selectConversationRunsData = (state: RootState) => state.conversationRuns.data

export const selectCurrentConversationRunId = (state: RootState) => state.currentIds.runId

export const selectCurrentConversationRunData = (state: RootState) =>
  state.conversationRuns.currentRun

export const selectCurrentConversationRunRecords = (state: RootState) =>
  state.conversationRuns.currentRunRecords

export const selectConversationRunsComparison = (state: RootState) =>
  state.conversationRuns.comparisonRecords

export const selectConversationRunAgentHistory = (state: RootState) =>
  state.conversationRuns.agentHistory

export const selectIsExecutingConversationRun = (state: RootState) =>
  state.conversationRuns.isExecuting

export const selectIsCancellingConversationRun = (state: RootState) =>
  state.conversationRuns.isCancelling
export const selectIsRetryingConversationRun = (state: RootState) =>
  state.conversationRuns.isRetrying

export const selectCurrentConversationRecordsQuery = (state: RootState) =>
  state.conversationRuns.currentRecordsQuery

export const selectIsConversationRunStatusStreamActive = (state: RootState) =>
  state.conversationRuns.runStatusStream.isActive

export const selectHasConversationRunsInProgress = createSelector(
  [selectConversationRunsData, selectCurrentConversationRunData],
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

export const selectConversationRunsForDataset = createSelector(
  [selectConversationRunsData, (_state: RootState, datasetId: string) => datasetId],
  (runsData, datasetId): AsyncData<EvaluationConversationRun[]> => {
    if (ADS.isFulfilled(runsData)) {
      const filtered = runsData.value.filter(
        (run) => run.evaluationConversationDatasetId === datasetId,
      )
      return { status: ADS.Fulfilled, error: null, value: filtered }
    }
    return runsData
  },
)
