import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { currentIdsActions } from "@/eval/store/currentIds.slice"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunStatus,
  EvaluationExtractionRunSummary,
  PaginatedEvaluationExtractionRunRecords,
} from "./evaluation-extraction-runs.models"
import { evaluationExtractionRunsThunks } from "./evaluation-extraction-runs.thunks"

interface RecordsQuery {
  page: number
  limit: number
  columnFilters?: Record<string, string>
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

interface State {
  // Mirrors state.currentIds.runId; kept locally so reducers can guard stale responses.
  currentRunId: string | null // FIXME:
  data: AsyncData<EvaluationExtractionRun[]>
  currentRun: AsyncData<EvaluationExtractionRun>
  currentRunRecords: AsyncData<PaginatedEvaluationExtractionRunRecords>
  currentRecordsQuery: RecordsQuery
  isExecuting: boolean
  isRetrying: boolean
  isCancelling: boolean
  runStatusStream: { isActive: boolean }
}

const defaultRecordsQuery: RecordsQuery = { page: 0, limit: 10 }

const initialState: State = {
  currentRunId: null,
  data: defaultAsyncData,
  currentRun: defaultAsyncData,
  currentRunRecords: defaultAsyncData,
  currentRecordsQuery: defaultRecordsQuery,
  isExecuting: false,
  isRetrying: false,
  isCancelling: false,
  runStatusStream: { isActive: false },
}

const slice = createSlice({
  name: "extractionRuns",
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
    patchRunStatus: (
      state,
      action: PayloadAction<{
        evaluationExtractionRunId: string
        status: EvaluationExtractionRunStatus
        summary: EvaluationExtractionRunSummary | null
        updatedAt: number
      }>,
    ) => {
      const { evaluationExtractionRunId, status, summary, updatedAt } = action.payload

      // Patch current run if it matches
      if (
        ADS.isFulfilled(state.currentRun) &&
        state.currentRun.value.id === evaluationExtractionRunId
      ) {
        state.currentRun.value.status = status
        state.currentRun.value.summary = summary
        state.currentRun.value.updatedAt = updatedAt
      }

      // Patch run in the list if it matches
      if (ADS.isFulfilled(state.data)) {
        const runInList = state.data.value.find((run) => run.id === evaluationExtractionRunId)
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
      .addCase(evaluationExtractionRunsThunks.getAll.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(evaluationExtractionRunsThunks.getAll.fulfilled, (state, action) => {
        state.data = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationExtractionRunsThunks.getAll.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list evaluation runs"
      })

    // getOne
    builder
      .addCase(evaluationExtractionRunsThunks.getOne.pending, (state) => {
        if (!ADS.isFulfilled(state.currentRun)) state.currentRun.status = ADS.Loading
        state.currentRun.error = null
      })
      .addCase(evaluationExtractionRunsThunks.getOne.fulfilled, (state, action) => {
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationExtractionRunsThunks.getOne.rejected, (state, action) => {
        state.currentRun.status = ADS.Error
        state.currentRun.error = action.error.message || "Failed to get evaluation run"
      })

    // getRecords
    builder
      .addCase(evaluationExtractionRunsThunks.getRecords.pending, (state, action) => {
        if (action.meta.arg.evaluationExtractionRunId !== state.currentRunId) return
        if (!ADS.isFulfilled(state.currentRunRecords)) state.currentRunRecords.status = ADS.Loading
        state.currentRunRecords.error = null
        state.currentRecordsQuery = {
          page: action.meta.arg.page ?? 0,
          limit: action.meta.arg.limit ?? 10,
          columnFilters: action.meta.arg.columnFilters,
          sortBy: action.meta.arg.sortBy,
          sortOrder: action.meta.arg.sortOrder,
        }
      })
      .addCase(evaluationExtractionRunsThunks.getRecords.fulfilled, (state, action) => {
        if (action.meta.arg.evaluationExtractionRunId !== state.currentRunId) return
        state.currentRunRecords = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(evaluationExtractionRunsThunks.getRecords.rejected, (state, action) => {
        if (action.meta.arg.evaluationExtractionRunId !== state.currentRunId) return
        state.currentRunRecords.status = ADS.Error
        state.currentRunRecords.error = action.error.message || "Failed to get run records"
      })

    // createAndExecute
    builder
      .addCase(evaluationExtractionRunsThunks.createAndExecute.pending, (state) => {
        state.isExecuting = true
      })
      .addCase(evaluationExtractionRunsThunks.createAndExecute.fulfilled, (state, action) => {
        state.isExecuting = false
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
        state.currentRunId = action.payload.id
      })
      .addCase(evaluationExtractionRunsThunks.createAndExecute.rejected, (state) => {
        state.isExecuting = false
      })

    // retryOne
    builder
      .addCase(evaluationExtractionRunsThunks.retryOne.pending, (state) => {
        state.isRetrying = true
      })
      .addCase(evaluationExtractionRunsThunks.retryOne.fulfilled, (state, action) => {
        state.isRetrying = false
        state.currentRun = { status: ADS.Fulfilled, error: null, value: action.payload }
        state.currentRunId = action.payload.id
      })
      .addCase(evaluationExtractionRunsThunks.retryOne.rejected, (state) => {
        state.isRetrying = false
      })

    // cancelOne
    builder
      .addCase(evaluationExtractionRunsThunks.cancelOne.pending, (state) => {
        state.isCancelling = true
      })
      .addCase(evaluationExtractionRunsThunks.cancelOne.fulfilled, (state, action) => {
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
      .addCase(evaluationExtractionRunsThunks.cancelOne.rejected, (state) => {
        state.isCancelling = false
      })
  },
})

export type { State as EvaluationExtractionRunsState }
export const evaluationExtractionRunsInitialState = initialState
export const evaluationExtractionRunsActions = {
  ...slice.actions,
  ...evaluationExtractionRunsThunks,
}
export const evaluationExtractionRunsSlice = slice
