import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitations,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
import { agentMembershipsActions } from "./agent-memberships.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.mount,
    effect: async (_, listenerApi) => {
      const agentId = selectCurrentAgentId(listenerApi.getState())
      if (!agentId) return
      await Promise.all([
        listenerApi.dispatch(agentMembershipsActions.list()),
        listenerApi.dispatch(agentMembershipsActions.listAssignableRoles()),
        listenerApi.dispatch(listInvitationsForTarget({ targetType: "agent", targetId: agentId })),
      ])
    },
  })
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(agentMembershipsActions.reset())
    },
  })

  // Refresh the list after roles change or members leave
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      agentMembershipsActions.addRoles.fulfilled,
      agentMembershipsActions.removeMany.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(agentMembershipsActions.list())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "agent") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "agent") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: action.payload.emailSent
            ? "agentMembership:notifications.invitationsSentByEmail"
            : "agentMembership:notifications.peopleInvited",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createInvitations.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentMembership:notifications.inviteError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.addRoles.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentMembership:notifications.rolesAdded",
          titleValues: { count: action.meta.arg.memberUserIds.length },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.removeMany.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentMembership:notifications.membersRemoved",
          titleValues: { count: action.meta.arg.memberUserIds.length },
          type: "success",
        }),
      )
    },
  })
}

export const agentMembershipsMiddleware = { listenerMiddleware, registerListeners }
