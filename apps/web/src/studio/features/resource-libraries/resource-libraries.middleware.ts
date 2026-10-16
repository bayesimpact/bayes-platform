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
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.created",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess(action.payload)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createResourceLibrary.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.createError",
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
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.updated",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateResourceLibrary.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.updateError",
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
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.deleted",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteResourceLibrary.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.deleteError",
          type: "error",
        }),
      )
    },
  })

  for (const saveResource of [addResource, updateResource]) {
    listenerMiddleware.startListening({
      actionCreator: saveResource.fulfilled,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "resourceLibrary:notifications.resourceSaved",
            type: "success",
          }),
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
          titleKey: "resourceLibrary:notifications.resourceSaveError",
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
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.resourceDeleted",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteResource.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "resourceLibrary:notifications.resourceDeleteError",
          type: "error",
        }),
      )
    },
  })
}

export const resourceLibrariesMiddleware = { listenerMiddleware, registerListeners }
