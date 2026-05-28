import { createListenerMiddleware } from "@reduxjs/toolkit"
import { hasAgentChanged } from "@/common/features/agents/agents.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectAgentSubAgentsMounted } from "./agent-sub-agents.selectors"
import { agentSubAgentsActions } from "./agent-sub-agents.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentSubAgentsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(agentSubAgentsActions.list())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentSubAgentsActions.unmount,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(agentSubAgentsActions.reset())
    },
  })

  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return (
        selectAgentSubAgentsMounted(currentState) && hasAgentChanged(originalState, currentState)
      )
    },
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(agentSubAgentsActions.list())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentSubAgentsActions.updateAll.fulfilled,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Sub-agents updated successfully",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentSubAgentsActions.updateAll.rejected,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to update sub-agents",
          type: "error",
        }),
      )
    },
  })
}

export const agentSubAgentsMiddleware = { listenerMiddleware, registerListeners }
