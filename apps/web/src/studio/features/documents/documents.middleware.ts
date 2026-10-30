import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createDocumentTag,
  deleteDocumentTag,
  updateDocumentTag,
} from "@/studio/features/document-tags/document-tags.thunks"
import { selectUploaderState } from "./documents.selectors"
import { documentsActions } from "./documents.slice"
import {
  addTagsToDocuments,
  deleteDocument,
  deleteDocuments,
  listDocuments,
  removeTagsFromDocuments,
  updateDocument,
  uploadDocument,
  uploadDocuments,
} from "./documents.thunks"
import {
  handleDocumentsContextChanged,
  startDocumentEmbeddingStatusStream,
  stopDocumentEmbeddingStatusStream,
  syncDocumentEmbeddingStatusStreamWithDocuments,
} from "./documents-stream-status"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: documentsActions.projectMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(documentsActions.setCurrentSourceType({ sourceType: "project" }))
      listenerApi.dispatch(documentsActions.startEmbeddingStatusStream())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: documentsActions.projectUnmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(documentsActions.stopEmbeddingStatusStream())
    },
  })

  // Refresh documents when current project or interface changes
  listenerMiddleware.startListening({
    actionCreator: projectsActions.mount,
    effect: async (_, listenerApi) => {
      await handleDocumentsContextChanged(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.setCurrentSourceType,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listDocuments())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.startEmbeddingStatusStream,
    effect: async (_, listenerApi) => {
      await startDocumentEmbeddingStatusStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.stopEmbeddingStatusStream,
    effect: async () => {
      stopDocumentEmbeddingStatusStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.patchDocumentEmbeddingStatus,
    effect: async (_, listenerApi) => {
      syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: listDocuments.fulfilled,
    effect: async (_, listenerApi) => {
      syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)
    },
  })

  // Refresh documents when one is uploaded, updated or deleted
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      // Document changes
      uploadDocument.fulfilled,
      uploadDocuments.fulfilled,
      updateDocument.fulfilled,
      deleteDocument.fulfilled,
      deleteDocuments.fulfilled,
      addTagsToDocuments.fulfilled,
      removeTagsFromDocuments.fulfilled,
      // DocumentTag changes
      createDocumentTag.fulfilled,
      updateDocumentTag.fulfilled,
      deleteDocumentTag.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listDocuments())
    },
  })

  listenerMiddleware.startListening({
    predicate(_, currentState) {
      return currentState.documents.data.value
        ? selectUploaderState(currentState).status === "completed"
        : false
    },
    effect: async (_, listenerApi) => {
      await listenerApi.delay(4000)
      listenerApi.dispatch(documentsActions.resetUploaderCounters())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: uploadDocuments.fulfilled,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const uploaderState = selectUploaderState(state)
      const errors = uploaderState.errors || []
      if (errors.length > 0) {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "document:notifications.uploadFailedCount",
            titleValues: { count: errors.length },
            type: "error",
          }),
        )
      }
    },
  })

  listenerMiddleware.startListening({
    actionCreator: uploadDocument.pending,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.uploading",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "info",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: uploadDocument.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.uploaded",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      const { id: documentId } = action.payload
      onSuccess?.({ documentId })
    },
  })
  listenerMiddleware.startListening({
    actionCreator: uploadDocument.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.uploadError",
          titleValues: { fileName: action.meta.arg.file.name },
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateDocument.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.updated",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateDocument.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.updateError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteDocument.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.deleted",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteDocument.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.deleteError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteDocuments.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.bulkDeleted",
          titleValues: { count: action.meta.arg.documentIds.length },
          type: "success",
        }),
      )
      action.meta.arg.onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteDocuments.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.bulkDeleteError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: addTagsToDocuments.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.tagsAdded",
          titleValues: { count: action.meta.arg.documentIds.length },
          type: "success",
        }),
      )
      action.meta.arg.onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: addTagsToDocuments.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.tagsAddError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: removeTagsFromDocuments.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.tagsRemoved",
          titleValues: { count: action.meta.arg.documentIds.length },
          type: "success",
        }),
      )
      action.meta.arg.onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: removeTagsFromDocuments.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "document:notifications.tagsRemoveError",
          type: "error",
        }),
      )
    },
  })
}

export const documentsMiddleware = { listenerMiddleware, registerListeners }
