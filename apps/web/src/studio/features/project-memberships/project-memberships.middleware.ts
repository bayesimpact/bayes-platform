import { createListenerMiddleware } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import { createMemberGrants } from "@/studio/features/member-grants/member-grants.thunks"
import { projectMembershipsActions } from "./project-memberships.slice"
import {
  listProjectMemberAgents,
  listProjectMemberships,
  removeProjectMembership,
} from "./project-memberships.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectMembershipsActions.mount,
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await listenerApi.dispatch(listProjectMemberships())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: projectMembershipsActions.memberMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const membershipId = getCurrentId({ state, name: "membershipId" })
      listenerApi.dispatch(listProjectMemberAgents({ membershipId }))
    },
  })

  // Refresh list after member removal
  listenerMiddleware.startListening({
    actionCreator: removeProjectMembership.fulfilled,
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await listenerApi.dispatch(listProjectMemberships())
    },
  })

  // Refresh list after members were added by email
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      await listenerApi.dispatch(listProjectMemberships())
    },
  })

  // Success notifications
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Members added",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: removeProjectMembership.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Member removed successfully",
          type: "success",
        }),
      )
    },
  })

  // Error notifications
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to add members",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: removeProjectMembership.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to remove member",
          type: "error",
        }),
      )
    },
  })
}

export const projectMembershipsMiddleware = { listenerMiddleware, registerListeners }
