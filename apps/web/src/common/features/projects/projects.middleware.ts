import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/studio/features/projects/projects.thunks"
import { fetchMe } from "../me/me.thunks"
import { notificationsActions } from "../notifications/notifications.slice"
import { selectCurrentOrganizationId } from "../organizations/organizations.selectors"
import { projectsActions } from "./projects.slice"
import { listProjects } from "./projects.thunks"

// Create typed listener middleware
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
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
    matcher: isAnyOf(deleteProject.fulfilled, createProject.fulfilled, updateProject.fulfilled),
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(fetchMe())
      await listenerApi.dispatch(listProjects())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteProject.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Project deleted successfully",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteProject.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Project deletion failed",
          type: "error",
        }),
      )
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

  listenerMiddleware.startListening({
    actionCreator: updateProject.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Project updated successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateProject.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Project update failed",
          type: "error",
        }),
      )
    },
  })
}

export const projectsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
