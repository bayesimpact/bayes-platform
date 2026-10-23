import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store"
import { conversationAgentSessionsActions } from "../../conversation/conversation-agent-sessions.slice"
import { createAgentChatSession, deleteAgentSession } from "./base-agent-sessions.thunks"

// Create typed listener middleware
export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()
function registerListeners() {
  // Refresh Agent sessions when one is created or deleted. A failed creation refreshes them too:
  // its pending case emptied the list, which would otherwise stay loading.
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      createAgentChatSession.fulfilled,
      createAgentChatSession.rejected,
      deleteAgentSession.fulfilled,
    ),
    effect: async (action, listenerApi) => {
      // @ts-expect-error
      const { agentId, agentType } = action.meta.arg
      switch (agentType) {
        case "conversation":
          await listenerApi.dispatch(conversationAgentSessionsActions.getAll({ agentId }))
          break
      }
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgentChatSession.fulfilled,
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
