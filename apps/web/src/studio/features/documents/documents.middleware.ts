import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createDocumentTag,
  deleteDocumentTag,
  updateDocumentTag,
} from "@/studio/features/document-tags/document-tags.thunks"
import { selectDocumentsData, selectUploaderState } from "./documents.selectors"
import { documentsActions } from "./documents.slice"
import {
  cancelCrawl,
  crawlUrl,
  deleteDocument,
  listDocuments,
  reCrawlUrl,
  updateDocument,
  uploadDocument,
  uploadDocuments,
} from "./documents.thunks"
import {
  handleDocumentsContextChanged,
  startDocumentCrawlProgressStream,
  startDocumentEmbeddingStatusStream,
  stopDocumentCrawlProgressStream,
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

  listenerMiddleware.startListening({
    actionCreator: documentsActions.webSourcesMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(documentsActions.setCurrentSourceType({ sourceType: "webCrawl" }))
      listenerApi.dispatch(documentsActions.startEmbeddingStatusStream())
      listenerApi.dispatch(documentsActions.startCrawlProgressStream())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: documentsActions.webSourcesUnmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(documentsActions.stopEmbeddingStatusStream())
      listenerApi.dispatch(documentsActions.stopCrawlProgressStream())
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
    actionCreator: documentsActions.startCrawlProgressStream,
    effect: async (_, listenerApi) => {
      await startDocumentCrawlProgressStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.stopCrawlProgressStream,
    effect: async () => {
      stopDocumentCrawlProgressStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: documentsActions.patchDocumentEmbeddingStatus,
    effect: async (action, listenerApi) => {
      syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)

      if (action.payload.embeddingStatus !== "completed") return

      // Refetch documents when a webCrawl document finishes embedding
      // so the content (crawled pages) is available for the dropdown
      const state = listenerApi.getState()
      const documents = selectDocumentsData(state)
      if (!ADS.isFulfilled(documents)) return
      const document = documents.value.find((document) => document.id === action.payload.documentId)
      if (document?.sourceType === "webCrawl") {
        // FIXME: potentially refetching the entire list is inefficient, consider only refetching the updated document
        listenerApi.dispatch(listDocuments())
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
      reCrawlUrl.fulfilled,
      cancelCrawl.fulfilled,
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
