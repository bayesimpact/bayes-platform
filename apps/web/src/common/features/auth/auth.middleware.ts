import { createListenerMiddleware } from "@reduxjs/toolkit"
import { authActions } from "@/common/features/auth/auth.slice"
import { meActions } from "@/common/features/me/me.slice"
import { fetchMe } from "@/common/features/me/me.thunks"
import { organizationsActions } from "@/common/features/organizations/organizations.slice"
import { fetchOrganizations } from "@/common/features/organizations/organizations.thunks"
import { fetchMyProjects } from "@/common/features/projects/projects.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"

// Create typed listener middleware
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: fetchMe.fulfilled,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(authActions.setStopLoading())
  },
})

// Listen for authentication state changes and automatically fetch user data
listenerMiddleware.startListening({
  actionCreator: authActions.setAuthenticated,
  effect: async (action, listenerApi) => {
    const isAuthenticated = action.payload

    if (isAuthenticated) {
      // /me links a first sign-in to the account of a person added by email,
      // so it runs before the organization and project lists that depend on it.
      // The project list carries the permissions that open each app, so it loads
      // here and not only on the home page: a deep link would otherwise never get it.
      await listenerApi.dispatch(fetchMe())
      await Promise.all([
        listenerApi.dispatch(fetchOrganizations()),
        listenerApi.dispatch(fetchMyProjects()),
      ])
    } else {
      // User logged out - clear user and organizations state
      listenerApi.dispatch(meActions.reset())
      listenerApi.dispatch(organizationsActions.reset())
    }
  },
})

export { listenerMiddleware as authMiddleware }
