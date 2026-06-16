import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createResourceLibrary,
  deleteResourceLibrary,
  listResourceLibraries,
  updateResourceLibrary,
} from "./resource-libraries.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listResourceLibraries())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      deleteResourceLibrary.fulfilled,
      createResourceLibrary.fulfilled,
      updateResourceLibrary.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listResourceLibraries())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createResourceLibrary.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library created", type: "success" }),
      )
      action.meta.arg.onSuccess(action.payload)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createResourceLibrary.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library creation failed", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateResourceLibrary.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library updated", type: "success" }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateResourceLibrary.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library update failed", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteResourceLibrary.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library deleted", type: "success" }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteResourceLibrary.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource library deletion failed", type: "error" }),
      )
    },
  })
}

export const resourceLibrariesMiddleware = { listenerMiddleware, registerListeners }
