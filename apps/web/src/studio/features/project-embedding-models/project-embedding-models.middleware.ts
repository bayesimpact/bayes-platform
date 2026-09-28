import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { projectEmbeddingModelsActions } from "./project-embedding-models.slice"
import {
  enableProjectEmbeddingModel,
  listProjectEmbeddingModels,
} from "./project-embedding-models.thunks"
import {
  startProjectEmbeddingModelsProgressStream,
  stopProjectEmbeddingModelsProgressStream,
  syncProjectEmbeddingModelsProgressStream,
} from "./project-embedding-models-stream-status"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.mount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(projectEmbeddingModelsActions.startProgressStream())
      await listenerApi.dispatch(listProjectEmbeddingModels())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(projectEmbeddingModelsActions.stopProgressStream())
      listenerApi.dispatch(projectEmbeddingModelsActions.reset())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.startProgressStream,
    effect: async (_, listenerApi) => {
      await startProjectEmbeddingModelsProgressStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.stopProgressStream,
    effect: async () => {
      stopProjectEmbeddingModelsProgressStream()
    },
  })

  // The stream only stays open while a model is pending or processing.
  listenerMiddleware.startListening({
    actionCreator: listProjectEmbeddingModels.fulfilled,
    effect: async (_, listenerApi) => {
      syncProjectEmbeddingModelsProgressStream(listenerApi)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: projectEmbeddingModelsActions.patchProgress,
    effect: async (_, listenerApi) => {
      syncProjectEmbeddingModelsProgressStream(listenerApi)
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
