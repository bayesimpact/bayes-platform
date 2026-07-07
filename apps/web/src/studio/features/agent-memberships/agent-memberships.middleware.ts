import { createListenerMiddleware } from "@reduxjs/toolkit"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitationsForTarget,
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

  // Refresh list after member removal
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.remove.fulfilled,
    effect: async (_, listenerApi) => {
      const agentId = selectCurrentAgentId(listenerApi.getState())
      if (!agentId) return
      await Promise.all([
        listenerApi.dispatch(agentMembershipsActions.list()),
        listenerApi.dispatch(listInvitationsForTarget({ targetType: "agent", targetId: agentId })),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "agent") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "agent") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Invitations sent successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to send invitations",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.remove.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Member removed successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.remove.rejected,
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

export const agentMembershipsMiddleware = { listenerMiddleware, registerListeners }
