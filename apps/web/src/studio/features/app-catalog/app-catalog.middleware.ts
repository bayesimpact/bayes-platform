import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { appCatalogActions } from "./app-catalog.slice"
import { listAppCatalog } from "./app-catalog.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: appCatalogActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAppCatalog())
    },
  })
}

export const appCatalogMiddleware = { listenerMiddleware, registerListeners }
