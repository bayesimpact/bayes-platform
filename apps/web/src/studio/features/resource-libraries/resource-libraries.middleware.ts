import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  addResource,
  createResourceLibrary,
  deleteResource,
  deleteResourceLibrary,
  listResourceLibraries,
  updateResource,
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
      addResource.fulfilled,
      updateResource.fulfilled,
      deleteResource.fulfilled,
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
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Resource library creation failed",
          description: action.payload || undefined,
          type: "error",
        }),
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
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Resource library update failed",
          description: action.payload || undefined,
          type: "error",
        }),
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

  for (const saveResource of [addResource, updateResource]) {
    listenerMiddleware.startListening({
      actionCreator: saveResource.fulfilled,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({ title: "Resource saved", type: "success" }),
        )
        action.meta.arg.onSuccess()
      },
    })
  }
  listenerMiddleware.startListening({
    matcher: isAnyOf(addResource.rejected, updateResource.rejected),
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Saving resource failed",
          description: typeof action.payload === "string" ? action.payload || undefined : undefined,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteResource.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource deleted", type: "success" }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteResource.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Resource deletion failed", type: "error" }),
      )
    },
  })
}

export const resourceLibrariesMiddleware = { listenerMiddleware, registerListeners }
