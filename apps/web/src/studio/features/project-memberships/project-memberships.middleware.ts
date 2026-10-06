import { createListenerMiddleware } from "@reduxjs/toolkit"
import i18next from "i18next"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitations,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
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
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
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
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  // Success notifications
  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: i18next.t(
            action.payload.emailSent
              ? "invitations:notifications.emailed"
              : "invitations:notifications.invited",
          ),
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
    actionCreator: createInvitations.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: i18next.t("invitations:notifications.failed"),
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
