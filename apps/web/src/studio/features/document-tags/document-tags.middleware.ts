import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createDocumentTag,
  deleteDocumentTag,
  listDocumentTags,
  updateDocumentTag,
} from "./document-tags.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh DocumentTags when current project or interface changes
  listenerMiddleware.startListening({
    actionCreator: projectsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listDocumentTags())
    },
  })

  // Refresh DocumentTags when one is created, updated or deleted
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      deleteDocumentTag.fulfilled,
      createDocumentTag.fulfilled,
      updateDocumentTag.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listDocumentTags())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteDocumentTag.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag deleted successfully",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteDocumentTag.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag deletion failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createDocumentTag.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag created successfully",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess(action.payload)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createDocumentTag.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag creation failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateDocumentTag.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag updated successfully",
          type: "success",
        }),
      )
      const onSuccess = action.meta.arg.onSuccess
      onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateDocumentTag.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document tag update failed",
          type: "error",
        }),
      )
    },
  })
}

export const documentTagsMiddleware = { listenerMiddleware, registerListeners }
