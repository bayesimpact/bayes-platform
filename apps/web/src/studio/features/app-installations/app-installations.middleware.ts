import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { appInstallationsActions } from "./app-installations.slice"
import { listAppInstallations, revokeProjectAppInstallation } from "./app-installations.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: appInstallationsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAppInstallations())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeProjectAppInstallation.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "appInstallations:notifications.revoked",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeProjectAppInstallation.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "appInstallations:notifications.revokeError",
          description: action.payload || undefined,
          type: "error",
        }),
      )
    },
  })
}

export const appInstallationsMiddleware = { listenerMiddleware, registerListeners }
