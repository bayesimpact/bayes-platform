import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { currentIdsActions } from "@/eval/store/currentIds.slice"
import {
  selectCurrentRecordsQuery,
  selectCurrentRunId,
} from "./evaluation-extraction-runs.selectors"
import { evaluationExtractionRunsActions } from "./evaluation-extraction-runs.slice"
import {
  startRunStatusStream,
  stopRunStatusStream,
  syncRunStatusStreamWithRuns,
} from "./evaluation-extraction-runs-stream-status"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: currentIdsActions.setDatasetId,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationExtractionRunsActions.getAll())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const runId = selectCurrentRunId(state)
      if (!runId) return

      listenerApi.dispatch(
        evaluationExtractionRunsActions.getOne({ evaluationExtractionRunId: runId }),
      )
      listenerApi.dispatch(evaluationExtractionRunsActions.startRunStatusStream())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationExtractionRunsActions.stopRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.createAndExecute.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Evaluation run started",
          type: "info",
        }),
      )
      listenerApi.dispatch(
        evaluationExtractionRunsActions.getOne({ evaluationExtractionRunId: action.payload.id }),
      )
      // Start SSE stream to track progress
      listenerApi.dispatch(evaluationExtractionRunsActions.startRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.createAndExecute.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Evaluation run failed to start",
          type: "error",
        }),
      )
    },
  })

  // SSE stream lifecycle
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.startRunStatusStream,
    effect: async (_, listenerApi) => {
      await startRunStatusStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.stopRunStatusStream,
    effect: async () => {
      stopRunStatusStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionRunsActions.patchRunStatus,
    effect: async (action, listenerApi) => {
      const { status, evaluationExtractionRunId } = action.payload

      const state = listenerApi.getState()

      // Refetch records for the current run to get the latest status and progress
      const query = selectCurrentRecordsQuery(state)
      listenerApi.dispatch(
        evaluationExtractionRunsActions.getRecords({ evaluationExtractionRunId, ...query }),
      )

      switch (status) {
        case "completed":
          {
            await listenerApi.dispatch(evaluationExtractionRunsActions.getAll())
            listenerApi.dispatch(
              notificationsActions.show({
                title: "Evaluation run completed successfully",
                type: "success",
              }),
            )
          }
          break
        case "failed":
          {
            await listenerApi.dispatch(evaluationExtractionRunsActions.getAll())
            listenerApi.dispatch(
              notificationsActions.show({
                title: "Evaluation run failed",
                type: "error",
              }),
            )
          }
          break

        default:
          await listenerApi.dispatch(
            evaluationExtractionRunsActions.getOne({ evaluationExtractionRunId }),
          )
          break
      }

      syncRunStatusStreamWithRuns(listenerApi)
    },
  })
}

export const evaluationExtractionRunsMiddleware = { listenerMiddleware, registerListeners }
