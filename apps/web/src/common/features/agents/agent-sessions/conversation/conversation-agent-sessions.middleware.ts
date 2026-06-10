import { createListenerMiddleware } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { AppDispatch, RootState } from "@/common/store"
import { listMessages } from "../shared/agent-session-messages/agent-session-messages.thunks"
import { conversationAgentSessionsActions } from "./conversation-agent-sessions.slice"

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Load conversation agent sessions when agent is loaded
  listenerMiddleware.startListening({
    actionCreator: conversationAgentSessionsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(conversationAgentSessionsActions.getAll({ agentId }))
    },
  })

  // Load messages when conversation agent session is loaded
  listenerMiddleware.startListening({
    actionCreator: conversationAgentSessionsActions.sessionMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentSessionId = getCurrentId({ state, name: "agentSessionId" })
      await listenerApi.dispatch(listMessages(agentSessionId))
    },
  })
}

export const conversationAgentSessionsMiddleware = { listenerMiddleware, registerListeners }
