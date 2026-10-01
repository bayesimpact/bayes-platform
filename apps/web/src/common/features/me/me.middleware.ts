import { isSignInError } from "@caseai-connect/api-contracts"
import { createListenerMiddleware } from "@reduxjs/toolkit"
import { authActions } from "@/common/features/auth/auth.slice"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { fetchOrganizations } from "@/common/features/organizations/organizations.thunks"
import { fetchMyProjects } from "@/common/features/projects/projects.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"
import { logout } from "@/external/oidcClient"
import { meActions } from "./me.slice"
import { acceptTerms, fetchMe, updateMe } from "./me.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: meActions.mountOnboarding,
  effect: (_, listenerApi) => {
    // both listings load in parallel; the grouping happens in a selector
    listenerApi.dispatch(fetchOrganizations())
    listenerApi.dispatch(fetchMyProjects())
  },
})

listenerMiddleware.startListening({
  actionCreator: fetchMe.rejected,
  effect: async (action, listenerApi) => {
    const httpStatus = action.payload?.status
    const isUnauthorizedRequest = httpStatus === 401 || httpStatus === 403

    // Signing in again would fail the same way: explain instead of logging out.
    if (httpStatus === 401 && isSignInError(action.payload?.message)) {
      listenerApi.dispatch(authActions.setSignInError(action.payload.message))
      return
    }

    if (isUnauthorizedRequest) {
      // Only force logout for auth failures. Network/CORS errors should surface in UI.
      localStorage.clear()
      await logout()
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
