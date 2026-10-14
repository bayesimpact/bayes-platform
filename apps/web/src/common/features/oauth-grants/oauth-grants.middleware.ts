import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { oauthGrantsActions } from "./oauth-grants.slice"
import { listOAuthGrants } from "./oauth-grants.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: oauthGrantsActions.mount,
  effect: async (_, listenerApi) => {
    await listenerApi.dispatch(listOAuthGrants())
  },
})

export { listenerMiddleware as oauthGrantsMiddleware }
