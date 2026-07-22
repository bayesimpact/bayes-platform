import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { currentIdsActions } from "@/eval/store/currentIds.slice"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  EvaluationConversationRunStatus,
  EvaluationConversationRunSummary,
  PaginatedEvaluationConversationRunRecords,
} from "./evaluation-conversation-runs.models"
import { evaluationConversationRunsThunks } from "./evaluation-conversation-runs.thunks"

interface RecordsQuery {
  page: number
  limit: number
}

interface State {
  // Mirrors state.currentIds.runId; kept locally so reducers can guard stale responses.
  currentRunId: string | null
  data: AsyncData<EvaluationConversationRun[]>
  currentRun: AsyncData<EvaluationConversationRun>
  currentRunRecords: AsyncData<PaginatedEvaluationConversationRunRecords>
  currentRecordsQuery: RecordsQuery
  // Run ids being compared (URL-driven, compare page) and their records keyed by run id.
  comparisonRunIds: string[]
  comparisonRecords: AsyncData<Record<string, EvaluationConversationRunRecord[]>>

  // Settings-version history of the agent selected in the run dialog, plus the
  // agent id of the latest request so stale responses can be discarded.
  agentHistory: AsyncData<Agent[]>
  agentHistoryAgentId: string | null
  isExecuting: boolean
  isRetrying: boolean
  isCancelling: boolean
  runStatusStream: { isActive: boolean }
}

const defaultRecordsQuery: RecordsQuery = { page: 0, limit: 10 }

function isCurrentComparison(
  comparisonRunIds: string[],
  requestArg: { evaluationConversationRunIds: string[] },
): boolean {
  return comparisonRunIds.join(",") === requestArg.evaluationConversationRunIds.join(",")
}

const initialState: State = {
  currentRunId: null,
  data: defaultAsyncData,
  currentRun: defaultAsyncData,
  currentRunRecords: defaultAsyncData,
  currentRecordsQuery: defaultRecordsQuery,
  comparisonRunIds: [],
  comparisonRecords: defaultAsyncData,
  agentHistory: defaultAsyncData,
  agentHistoryAgentId: null,
  isExecuting: false,
  isRetrying: false,
  isCancelling: false,
  runStatusStream: { isActive: false },
}

const slice = createSlice({
  name: "conversationRuns",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    // Compare-page lifecycle (ADR 0009): the middleware fetches on compareMount;
    // unmounting clears the comparison so a later visit never flashes stale data.
    compareMount: () => {},
    compareUnmount: (state) => {
      state.comparisonRunIds = []
      state.comparisonRecords = defaultAsyncData
    },
    // URL-driven, set by the compare route (same role as useSetCurrentIds).
    setComparisonRunIds: (state, action: PayloadAction<string[]>) => {
      if (state.comparisonRunIds.join(",") === action.payload.join(",")) return
      state.comparisonRunIds = action.payload
      state.comparisonRecords = defaultAsyncData
    },
    reset: () => initialState,
    resetAgentHistory: (state) => {
      state.agentHistory = defaultAsyncData
      state.agentHistoryAgentId = null
    },
    startRunStatusStream: (state) => {
      state.runStatusStream.isActive = true
    },
    stopRunStatusStream: (state) => {
      state.runStatusStream.isActive = false
    },
    patchRunStatus: (
      state,
      action: PayloadAction<{
        evaluationConversationRunId: string
        status: EvaluationConversationRunStatus
        summary: EvaluationConversationRunSummary | null
        updatedAt: number
      }>,
    ) => {
      const { evaluationConversationRunId, status, summary, updatedAt } = action.payload

      // Patch current run if it matches
      if (
        ADS.isFulfilled(state.currentRun) &&
        state.currentRun.value.id === evaluationConversationRunId
      ) {
        state.currentRun.value.status = status
        state.currentRun.value.summary = summary
        state.currentRun.value.updatedAt = updatedAt
      }

      // Patch run in the list if it matches
      if (ADS.isFulfilled(state.data)) {
        const runInList = state.data.value.find((run) => run.id === evaluationConversationRunId)
        if (runInList) {
          runInList.status = status
          runInList.summary = summary
          runInList.updatedAt = updatedAt
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Sync currentRunId from URL-driven currentIds slice and clear stale per-run state on change.
    builder.addCase(currentIdsActions.setRunId, (state, action) => {
      if (state.currentRunId !== action.payload) {
        state.currentRunRecords = defaultAsyncData
        state.currentRecordsQuery = defaultRecordsQuery
        state.currentRun = defaultAsyncData
        state.currentRunId = action.payload
      }
    })

    // getAll
    builder
      .addCase(evaluationConversationRunsThunks.getAll.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(evaluationConversationRunsThunks.getAll.fulfilled, (state, action) => {
        state.data = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationConversationRunsThunks.getAll.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list evaluation runs"
      })

    // getOne
    builder
      .addCase(evaluationConversationRunsThunks.getOne.pending, (state) => {
        if (!ADS.isFulfilled(state.currentRun)) state.currentRun.status = ADS.Loading
        state.currentRun.error = null
      })
      .addCase(evaluationConversationRunsThunks.getOne.fulfilled, (state, action) => {
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationConversationRunsThunks.getOne.rejected, (state, action) => {
        state.currentRun.status = ADS.Error
        state.currentRun.error = action.error.message || "Failed to get evaluation run"
      })

    // getRecords
    builder
      .addCase(evaluationConversationRunsThunks.getRecords.pending, (state, action) => {
        if (action.meta.arg.evaluationConversationRunId !== state.currentRunId) return
        if (!ADS.isFulfilled(state.currentRunRecords)) state.currentRunRecords.status = ADS.Loading
        state.currentRunRecords.error = null
        state.currentRecordsQuery = {
          page: action.meta.arg.page ?? 0,
          limit: action.meta.arg.limit ?? 10,
        }
      })
      .addCase(evaluationConversationRunsThunks.getRecords.fulfilled, (state, action) => {
        if (action.meta.arg.evaluationConversationRunId !== state.currentRunId) return
        state.currentRunRecords = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationConversationRunsThunks.getRecords.rejected, (state, action) => {
        if (action.meta.arg.evaluationConversationRunId !== state.currentRunId) return
        state.currentRunRecords.status = ADS.Error
        state.currentRunRecords.error = action.error.message || "Failed to get run records"
      })

    // getComparisonRecords — responses for run ids other than the current
    // comparison are stale (the user already navigated on) and are discarded.
    builder
      .addCase(evaluationConversationRunsThunks.getComparisonRecords.pending, (state, action) => {
        if (!isCurrentComparison(state.comparisonRunIds, action.meta.arg)) return
        if (!ADS.isFulfilled(state.comparisonRecords)) {
          state.comparisonRecords.status = ADS.Loading
        }
        state.comparisonRecords.error = null
      })
      .addCase(evaluationConversationRunsThunks.getComparisonRecords.fulfilled, (state, action) => {
        if (!isCurrentComparison(state.comparisonRunIds, action.meta.arg)) return
        state.comparisonRecords = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationConversationRunsThunks.getComparisonRecords.rejected, (state, action) => {
        if (!isCurrentComparison(state.comparisonRunIds, action.meta.arg)) return
        state.comparisonRecords.status = ADS.Error
        state.comparisonRecords.error = action.error.message || "Failed to load runs to compare"
      })

    // getAgentHistory — only the response for the most recently selected agent
    // applies; a slower response for a previously selected agent is discarded.
    builder
      .addCase(evaluationConversationRunsThunks.getAgentHistory.pending, (state, action) => {
        state.agentHistoryAgentId = action.meta.arg.agentId
        if (!ADS.isFulfilled(state.agentHistory)) state.agentHistory.status = ADS.Loading
        state.agentHistory.error = null
      })
      .addCase(evaluationConversationRunsThunks.getAgentHistory.fulfilled, (state, action) => {
        if (action.meta.arg.agentId !== state.agentHistoryAgentId) return
        state.agentHistory = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationConversationRunsThunks.getAgentHistory.rejected, (state, action) => {
        if (action.meta.arg.agentId !== state.agentHistoryAgentId) return
        state.agentHistory.status = ADS.Error
        state.agentHistory.error = action.error.message || "Failed to load agent version history"
      })

    // createAndExecute
    builder
      .addCase(evaluationConversationRunsThunks.createAndExecute.pending, (state) => {
        state.isExecuting = true
      })
      .addCase(evaluationConversationRunsThunks.createAndExecute.fulfilled, (state, action) => {
        state.isExecuting = false
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
        state.currentRunId = action.payload.id
      })
      .addCase(evaluationConversationRunsThunks.createAndExecute.rejected, (state) => {
        state.isExecuting = false
      })

    // retryOne
    builder
      .addCase(evaluationConversationRunsThunks.retryOne.pending, (state) => {
        state.isRetrying = true
      })
      .addCase(evaluationConversationRunsThunks.retryOne.fulfilled, (state, action) => {
        state.isRetrying = false
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
        state.currentRunId = action.payload.id
      })
      .addCase(evaluationConversationRunsThunks.retryOne.rejected, (state) => {
        state.isRetrying = false
      })

    // cancelOne
    builder
      .addCase(evaluationConversationRunsThunks.cancelOne.pending, (state) => {
        state.isCancelling = true
      })
      .addCase(evaluationConversationRunsThunks.cancelOne.fulfilled, (state, action) => {
        state.isCancelling = false
        const cancelledRun = action.payload
        if (ADS.isFulfilled(state.currentRun) && state.currentRun.value.id === cancelledRun.id) {
          state.currentRun.value = cancelledRun
        }
        if (ADS.isFulfilled(state.data)) {
          const runInList = state.data.value.find((run) => run.id === cancelledRun.id)
          if (runInList) {
            runInList.status = cancelledRun.status
            runInList.summary = cancelledRun.summary
            runInList.updatedAt = cancelledRun.updatedAt
          }
        }
      })
      .addCase(evaluationConversationRunsThunks.cancelOne.rejected, (state) => {
        state.isCancelling = false
      })
  },
})

export type { State as EvaluationConversationRunsState }
export const evaluationConversationRunsInitialState = initialState
export const evaluationConversationRunsActions = {
  ...slice.actions,
  ...evaluationConversationRunsThunks,
}
export const evaluationConversationRunsSlice = slice
