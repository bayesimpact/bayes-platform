import { isSignInError } from "@caseai-connect/api-contracts"
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { authActions } from "@/common/features/auth/auth.slice"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { fetchOrganizations } from "@/common/features/organizations/organizations.thunks"
import { fetchMyProjects } from "@/common/features/projects/projects.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"
import { logout } from "@/external/oidcClient"
import {
  acceptInvitation,
  declineInvitation,
} from "@/studio/features/invitations/invitations.thunks"
import { meActions } from "./me.slice"
import { acceptTerms, fetchMe, fetchPendingInvitations, updateMe } from "./me.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: meActions.mountOnboarding,
  effect: (_, listenerApi) => {
    // both listings load in parallel; the grouping happens in a selector
    listenerApi.dispatch(fetchOrganizations())
    listenerApi.dispatch(fetchMyProjects())
    listenerApi.dispatch(fetchPendingInvitations())
  },
})

listenerMiddleware.startListening({
  actionCreator: acceptInvitation.fulfilled,
  effect: async (_, listenerApi) => {
    // The new memberships show up in me, the organizations and the projects.
    await Promise.all([
      listenerApi.dispatch(fetchPendingInvitations()),
      listenerApi.dispatch(fetchMe()),
      listenerApi.dispatch(fetchOrganizations()),
      listenerApi.dispatch(fetchMyProjects()),
    ])
  },
})

listenerMiddleware.startListening({
  actionCreator: declineInvitation.fulfilled,
  effect: (_, listenerApi) => {
    listenerApi.dispatch(fetchPendingInvitations())
  },
})

listenerMiddleware.startListening({
  matcher: isAnyOf(acceptInvitation.rejected, declineInvitation.rejected),
  effect: (_, listenerApi) => {
    // The invitation may have been revoked meanwhile: refresh the list.
    listenerApi.dispatch(fetchPendingInvitations())
    listenerApi.dispatch(
      notificationsActions.show({
        titleKey: "me:notifications.invitationAnswerError",
        type: "error",
      }),
    )
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
        titleKey: "me:notifications.apiUnreachable",
        descriptionKey: "me:notifications.apiUnreachableDescription",
        type: "error",
      }),
    )
  },
})

listenerMiddleware.startListening({
  actionCreator: updateMe.fulfilled,
  effect: (_, listenerApi) => {
    listenerApi.dispatch(fetchMe())
    listenerApi.dispatch(
      notificationsActions.show({ titleKey: "me:notifications.profileUpdated", type: "success" }),
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
