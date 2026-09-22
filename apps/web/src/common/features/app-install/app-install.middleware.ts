import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectAppInstallSlug } from "./app-install.selectors"
import { appInstallActions } from "./app-install.slice"
import { authorizeAppInstall, fetchInstallPage } from "./app-install.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: appInstallActions.mount,
  effect: async (_, listenerApi) => {
    const slug = selectAppInstallSlug(listenerApi.getState())
    if (slug) await listenerApi.dispatch(fetchInstallPage(slug))
  },
})

listenerMiddleware.startListening({
  actionCreator: authorizeAppInstall.rejected,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "App installation failed",
        description: action.payload || undefined,
        type: "error",
      }),
    )
  },
})

export { listenerMiddleware as appInstallMiddleware }
