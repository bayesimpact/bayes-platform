import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectOAuthConsentRequest } from "./oauth-consent.selectors"
import { oauthConsentActions } from "./oauth-consent.slice"
import { approveOAuthConsent, fetchOAuthConsentPage } from "./oauth-consent.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: oauthConsentActions.mount,
  effect: async (_, listenerApi) => {
    const request = selectOAuthConsentRequest(listenerApi.getState())
    if (request) await listenerApi.dispatch(fetchOAuthConsentPage(request))
  },
})

listenerMiddleware.startListening({
  actionCreator: approveOAuthConsent.rejected,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        titleKey: "oauthConsent:notifications.approveError",
        description: action.payload || undefined,
        type: "error",
      }),
    )
  },
})

export { listenerMiddleware as oauthConsentMiddleware }
