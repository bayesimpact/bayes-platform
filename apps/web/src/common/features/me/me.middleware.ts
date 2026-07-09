import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { logoutAuth0 } from "@/external/auth0Client"
import { acceptInvitation } from "@/studio/features/invitations/invitations.thunks"
import { meActions } from "./me.slice"
import { acceptTerms, fetchMe, fetchPendingInvitations, updateMe } from "./me.thunks"

// Temporary polling interval to refresh pending invitations until we implement
// websockets or server-sent events.
const PENDING_INVITATIONS_POLL_INTERVAL_MS = 30_000

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: meActions.mountOnboarding,
  effect: async (_, listenerApi) => {
    // Ensure a single polling loop runs even if onboarding mounts several times.
    listenerApi.cancelActiveListeners()

    // Fetch immediately, then poll while onboarding stays mounted.
    listenerApi.dispatch(fetchPendingInvitations())

    const pollingTask = listenerApi.fork(async (forkApi) => {
      while (true) {
        await forkApi.delay(PENDING_INVITATIONS_POLL_INTERVAL_MS)
        listenerApi.dispatch(fetchPendingInvitations())
      }
    })

    // Stop polling once onboarding unmounts.
    await listenerApi.condition(meActions.unmountOnboarding.match)
    pollingTask.cancel()
  },
})

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
  actionCreator: updateMe.fulfilled,
  effect: (_, listenerApi) => {
    listenerApi.dispatch(fetchMe())
    listenerApi.dispatch(notificationsActions.show({ title: "Profile updated", type: "success" }))
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
