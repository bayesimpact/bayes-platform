import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store"
import { conversationAgentSessionsActions } from "../../conversation/conversation-agent-sessions.slice"
import { formAgentSessionsActions } from "../../form/form-agent-sessions.slice"
import { createAgentChatSession, deleteAgentSession } from "./base-agent-sessions.thunks"

// Create typed listener middleware
export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()
function registerListeners() {
  // Refresh Agent sessions when one is created or deleted
  listenerMiddleware.startListening({
    matcher: isAnyOf(createAgentChatSession.fulfilled, deleteAgentSession.fulfilled),
    effect: async (action, listenerApi) => {
      // @ts-expect-error
      const { agentId, agentType } = action.meta.arg
      switch (agentType) {
        case "conversation":
          await listenerApi.dispatch(conversationAgentSessionsActions.getAll({ agentId }))
          break

        case "form":
          await listenerApi.dispatch(formAgentSessionsActions.getAll({ agentId }))
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
