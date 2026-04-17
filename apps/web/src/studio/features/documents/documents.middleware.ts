import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { hasProjectChanged } from "@/common/features/projects/projects.selectors"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createDocumentTag,
  deleteDocumentTag,
  updateDocumentTag,
} from "@/studio/features/document-tags/document-tags.thunks"
import { selectUploaderState } from "./documents.selectors"
import { documentsActions } from "./documents.slice"
import {
  crawlUrl,
  deleteDocument,
  listDocuments,
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
  // Refresh documents when current project or interface changes
  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return hasProjectChanged(originalState, currentState)
    },
    effect: async (_, listenerApi) => {
      await handleDocumentsContextChanged(listenerApi)
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
    effect: async (action, listenerApi) => {
      syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)

      // Refetch documents when a webCrawl document finishes embedding
      // so the content (crawled pages) is available for the dropdown
      if (action.payload.embeddingStatus === "completed") {
        const state = listenerApi.getState()
        if (ADS.isFulfilled(state.studio.documents.data)) {
          const document = state.studio.documents.data.value.find(
            (document) => document.id === action.payload.documentId,
          )
          if (document?.sourceType === "webCrawl") {
            listenerApi.dispatch(listDocuments())
          }
        }
      }
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
      crawlUrl.fulfilled,
      updateDocument.fulfilled,
      deleteDocument.fulfilled,
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
      return currentState.studio.documents.data.value
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
            title: `${errors.length} documents failed to upload`,
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
          title: `Uploading ${action.meta.arg.file.name}...`,
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
          title: `${action.meta.arg.file.name} uploaded successfully`,
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
          title: `${action.meta.arg.file.name} upload failed`,
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
          title: "Document updated successfully",
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
          title: "Document update failed",
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
          title: "Document deleted successfully",
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
          title: "Document deletion failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: crawlUrl.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: action.payload.message,
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: crawlUrl.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Website crawl failed",
          type: "error",
        }),
      )
    },
  })
}

export const documentsMiddleware = { listenerMiddleware, registerListeners }
