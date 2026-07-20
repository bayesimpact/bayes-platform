import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import {
  selectCurrentConversationRecordsQuery,
  selectCurrentConversationRunId,
} from "./evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "./evaluation-conversation-runs.slice"
import {
  startConversationRunStatusStream,
  stopConversationRunStatusStream,
  syncConversationRunStatusStreamWithRuns,
} from "./evaluation-conversation-runs-stream-status"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.mount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationRunsActions.getAll())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const runId = selectCurrentConversationRunId(state)
      if (!runId) return

      listenerApi.dispatch(
        evaluationConversationRunsActions.getOne({ evaluationConversationRunId: runId }),
      )
      listenerApi.dispatch(evaluationConversationRunsActions.startRunStatusStream())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationRunsActions.stopRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.createAndExecute.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Evaluation run started",
          type: "info",
        }),
      )
      listenerApi.dispatch(
        evaluationConversationRunsActions.getOne({
          evaluationConversationRunId: action.payload.id,
        }),
      )
      // Start SSE stream to track progress
      listenerApi.dispatch(evaluationConversationRunsActions.startRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.createAndExecute.rejected,
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
    actionCreator: evaluationConversationRunsActions.startRunStatusStream,
    effect: async (_, listenerApi) => {
      await startConversationRunStatusStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.stopRunStatusStream,
    effect: async () => {
      stopConversationRunStatusStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.patchRunStatus,
    effect: async (action, listenerApi) => {
      const { status, evaluationConversationRunId } = action.payload

      const state = listenerApi.getState()

      // Refetch records for the current run only: the slice discards responses for
      // other runs, so refetching them would just hammer the API for nothing.
      if (evaluationConversationRunId === selectCurrentConversationRunId(state)) {
        const query = selectCurrentConversationRecordsQuery(state)
        listenerApi.dispatch(
          evaluationConversationRunsActions.getRecords({ evaluationConversationRunId, ...query }),
        )
      }

      switch (status) {
        case "completed":
          {
            await listenerApi.dispatch(evaluationConversationRunsActions.getAll())
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
            await listenerApi.dispatch(evaluationConversationRunsActions.getAll())
            listenerApi.dispatch(
              notificationsActions.show({
                title: "Evaluation run failed",
                type: "error",
              }),
            )
          }
          break

        default:
          break
      }

      syncConversationRunStatusStreamWithRuns(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.deleteOne.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationRunsActions.getAll())
      listenerApi.dispatch(notificationsActions.show({ title: "Run deleted", type: "success" }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.deleteOne.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to delete run", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationRunsActions.cancelOne.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Run cancelled", type: "success" }))
      stopConversationRunStatusStream()
      listenerApi.dispatch(evaluationConversationRunsActions.getAll())
    },
  })
}

export const evaluationConversationRunsMiddleware = { listenerMiddleware, registerListeners }
