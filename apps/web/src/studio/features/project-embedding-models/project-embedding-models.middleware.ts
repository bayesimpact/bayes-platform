import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { startPolling } from "@/common/store/polling"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectHasProjectEmbeddingModelsInProgress } from "./project-embedding-models.selectors"
import { projectEmbeddingModelsActions } from "./project-embedding-models.slice"
import {
  enableProjectEmbeddingModel,
  listProjectEmbeddingModels,
} from "./project-embedding-models.thunks"

// A re-embedding job reports its progress on the row; refresh while one is running.
const PROGRESS_POLL_INTERVAL_MS = 5_000

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.mount,
    effect: (_, listenerApi) =>
      startPolling(listenerApi, {
        stopWhen: projectEmbeddingModelsActions.unmount.match,
        intervalMs: PROGRESS_POLL_INTERVAL_MS,
        poll: () => {
          const state = listenerApi.getState()
          const isFirstLoad = state.projectEmbeddingModels.data.value === null
          if (isFirstLoad || selectHasProjectEmbeddingModelsInProgress(state)) {
            listenerApi.dispatch(listProjectEmbeddingModels())
          }
        },
      }),
  })

  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(projectEmbeddingModelsActions.reset())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: enableProjectEmbeddingModel.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: `Embedding model ${action.payload.modelName} enabled, re-embedding documents`,
          type: "success",
        }),
      )
      listenerApi.dispatch(listProjectEmbeddingModels())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: enableProjectEmbeddingModel.rejected,
    effect: async (action, listenerApi) => {
      // A refusal usually means the list was stale (a job already runs): show the real state.
      listenerApi.dispatch(listProjectEmbeddingModels())
      listenerApi.dispatch(
        notificationsActions.show({
          title: action.error.message || "Could not enable the embedding model",
          type: "error",
        }),
      )
    },
  })
}

export const projectEmbeddingModelsMiddleware = { listenerMiddleware, registerListeners }
