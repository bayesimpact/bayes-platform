import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { createProject } from "@/studio/features/projects/projects.thunks"
import { fetchMe } from "../me/me.thunks"
import { notificationsActions } from "../notifications/notifications.slice"
import { selectCurrentOrganizationId } from "../organizations/organizations.selectors"
import { fetchOrganizations } from "../organizations/organizations.thunks"
import { projectsActions } from "./projects.slice"
import { listProjects } from "./projects.thunks"

// Create typed listener middleware
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

// List projects when the current organization changes
listenerMiddleware.startListening({
  actionCreator: projectsActions.mount,
  effect: async (_, listenerApi) => {
    const state = listenerApi.getState()
    if (!selectCurrentOrganizationId(state)) return
    await listenerApi.dispatch(listProjects())
  },
})

listenerMiddleware.startListening({
  actionCreator: createProject.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Project created successfully",
        type: "success",
      }),
    )

    await Promise.all([listenerApi.dispatch(fetchMe()), listenerApi.dispatch(fetchOrganizations())])
    await listenerApi.dispatch(listProjects())

    const onSuccess = action.meta.arg.onSuccess
    const { id } = action.payload
    onSuccess?.(id)
  },
})
listenerMiddleware.startListening({
  actionCreator: createProject.rejected,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Project creation failed",
        type: "error",
      }),
    )
  },
})

export { listenerMiddleware as projectsMiddleware }
