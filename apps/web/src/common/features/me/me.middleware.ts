import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { logoutAuth0 } from "@/external/auth0Client"
import { acceptInvitation } from "@/studio/features/invitations/invitations.thunks"
import { acceptTerms, fetchMe, fetchPendingInvitations } from "./me.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: acceptInvitation.fulfilled,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(fetchPendingInvitations())
    listenerApi.dispatch(fetchMe())
  },
})

listenerMiddleware.startListening({
  actionCreator: fetchMe.rejected,
  effect: async (action, listenerApi) => {
    const httpStatus = action.payload?.status
    const isUnauthorizedRequest = httpStatus === 401 || httpStatus === 403

    if (isUnauthorizedRequest) {
      // Only force logout for auth failures. Network/CORS errors should surface in UI.
      localStorage.clear()
      await logoutAuth0()
      return
    }

    listenerApi.dispatch(
      notificationsActions.show({
        title: "Unable to reach the API",
        description:
          "Please check that the API is running and CORS is configured for this web app origin.",
        type: "error",
      }),
    )
  },
})

listenerMiddleware.startListening({
  actionCreator: acceptTerms.fulfilled,
  effect: async (_, listenerApi) => {
    // Refresh me so termsAccepted flips to true and ProtectedRoute lets the user through.
    listenerApi.dispatch(fetchMe())
  },
})

export { listenerMiddleware as meMiddleware }
