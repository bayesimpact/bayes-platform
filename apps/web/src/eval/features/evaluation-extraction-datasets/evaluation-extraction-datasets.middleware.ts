import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { evaluationExtractionDatasetsActions } from "./evaluation-extraction-datasets.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.mount,
    effect: async (_, listenerApi) => {
      await Promise.all([
        listenerApi.dispatch(evaluationExtractionDatasetsActions.listDatasets()),
        listenerApi.dispatch(evaluationExtractionDatasetsActions.listFiles()),
      ])
    },
  })

  // Clear stale records when the URL-driven currentIds.datasetId changes.
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationExtractionDatasetsActions.resetRecords())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      evaluationExtractionDatasetsActions.createOne.fulfilled,
      evaluationExtractionDatasetsActions.updateOne.fulfilled,
      evaluationExtractionDatasetsActions.renameOne.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationExtractionDatasetsActions.listDatasets())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.createOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.created",
          titleValues: { name: action.meta.arg.name },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.createOne.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.createError",
          titleValues: { name: action.meta.arg.name },
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.updateOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.updated",
          titleValues: { name: action.meta.arg.name },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.updateOne.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.updateError",
          titleValues: { name: action.meta.arg.name },
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.renameOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.renamed",
          titleValues: { name: action.meta.arg.name },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.renameOne.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.renameError",
          titleValues: { name: action.meta.arg.name },
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.deleteOne.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationExtractionDatasetsActions.listDatasets())
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.deleted",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.deleteOne.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.deleteError",
          type: "error",
        }),
      )
    },
  })

  registerFileListeners()
}

export const evaluationExtractionDatasetsMiddleware = {
  listenerMiddleware,
  registerListeners,
}

function registerFileListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      evaluationExtractionDatasetsActions.uploadFile.fulfilled,
      evaluationExtractionDatasetsActions.deleteFiles.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      await Promise.all([listenerApi.dispatch(evaluationExtractionDatasetsActions.listFiles())])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.uploadFile.pending,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.uploading",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "info",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.uploadFile.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.fileUploaded",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.uploadFile.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.fileUploadError",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.deleteFiles.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.filesDeleted",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationExtractionDatasetsActions.deleteFiles.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "evaluation:notifications.fileDeleteError",
          type: "error",
        }),
      )
    },
  })
}
