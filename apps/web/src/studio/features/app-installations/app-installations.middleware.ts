import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { appInstallationsActions } from "./app-installations.slice"
import { listAppInstallations } from "./app-installations.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: appInstallationsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAppInstallations())
    },
  })
}

export const appInstallationsMiddleware = { listenerMiddleware, registerListeners }
