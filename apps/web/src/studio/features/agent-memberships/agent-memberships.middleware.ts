import { createListenerMiddleware } from "@reduxjs/toolkit"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { createMemberGrants } from "@/studio/features/member-grants/member-grants.thunks"
import { agentMembershipsActions } from "./agent-memberships.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentMembershipsActions.mount,
    effect: async (_, listenerApi) => {
      const agentId = selectCurrentAgentId(listenerApi.getState())
      if (!agentId) return
      await listenerApi.dispatch(agentMembershipsActions.list())
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
      await listenerApi.dispatch(agentMembershipsActions.list())
    },
  })

  // Refresh list after members were added by email
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "agent") return
      await listenerApi.dispatch(agentMembershipsActions.list())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Members added",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "agent") return
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to add members",
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
