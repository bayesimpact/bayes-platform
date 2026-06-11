import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { listProjects } from "@/common/features/projects/projects.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  addProjectAgentSessionCategory,
  deleteProject,
  deleteProjectAgentSessionCategory,
  updateProject,
} from "./projects.thunks"

// Create typed listener middleware
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(deleteProject.fulfilled, updateProject.fulfilled),
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(fetchMe())
      await listenerApi.dispatch(listProjects())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      addProjectAgentSessionCategory.fulfilled,
      deleteProjectAgentSessionCategory.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listProjects())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: addProjectAgentSessionCategory.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.assignToAllConversationalAgents) {
        await listenerApi.dispatch(listAgents())
      }
    },
  })
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      addProjectAgentSessionCategory.rejected,
      deleteProjectAgentSessionCategory.rejected,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to update conversation categories",
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
}

export const studioProjectsMiddleware = { listenerMiddleware, registerListeners }
