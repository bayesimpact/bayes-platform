import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import {
  hasProjectChanged,
  selectCurrentProjectId,
} from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitationsForTarget,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
import { listProjectMemberships, removeProjectMembership } from "./project-memberships.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh project memberships when current project changes
  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return hasProjectChanged(originalState, currentState)
    },
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
    },
  })

  // Refresh list after member removal
  listenerMiddleware.startListening({
    actionCreator: removeProjectMembership.fulfilled,
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  // Success notifications
  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Invitations sent successfully",
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
    actionCreator: createInvitationsForTarget.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to send invitations",
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
