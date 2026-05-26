import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import type { AppDispatch, RootState } from "@/common/store"
import {
  createAgentSession,
  deleteAgentSession,
  listAgentSessionsForAgents,
  loadAgentSessionsForAllAgents,
} from "./base-agent-sessions.thunks"

// Create typed listener middleware
export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()
function registerListeners() {
  // Refresh agent sessions when Agents are loaded
  listenerMiddleware.startListening({
    actionCreator: listAgents.fulfilled,
    effect: async ({ payload: agents }, listenerApi) => {
      await loadAgentSessionsForAllAgents({ agentType: "conversation", agents, listenerApi })
      await loadAgentSessionsForAllAgents({ agentType: "form", agents, listenerApi })
      await loadAgentSessionsForAllAgents({ agentType: "extraction", agents, listenerApi })
    },
  })

  // Refresh Agent sessions when one is created or deleted
  listenerMiddleware.startListening({
    matcher: isAnyOf(createAgentSession.fulfilled, deleteAgentSession.fulfilled),
    effect: async (action, listenerApi) => {
      // @ts-expect-error
      const { agentId, agentType } = action.meta.arg
      await listenerApi.dispatch(listAgentSessionsForAgents({ agentType, agentIds: [agentId] }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgentSession.fulfilled,
    effect: async (action) => {
      const { id } = action.payload
      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.(id)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgentSession.fulfilled,
    effect: async (action) => {
      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.()
    },
  })
}

export const baseAgentSessionsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
