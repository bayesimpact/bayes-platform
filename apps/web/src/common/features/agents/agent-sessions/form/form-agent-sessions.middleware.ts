import { createListenerMiddleware } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { AppDispatch, RootState } from "@/common/store"
import { listMessages } from "../shared/agent-session-messages/agent-session-messages.thunks"
import { formAgentSessionsActions } from "./form-agent-sessions.slice"

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Load form agent sessions when agent is loaded
  listenerMiddleware.startListening({
    actionCreator: formAgentSessionsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      listenerApi.dispatch(formAgentSessionsActions.getAll({ agentId }))
    },
  })

  // Load messages when form agent session is loaded
  listenerMiddleware.startListening({
    actionCreator: formAgentSessionsActions.sessionMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentSessionId = getCurrentId({ state, name: "agentSessionId" })
      listenerApi.dispatch(listMessages(agentSessionId))
    },
  })
}

export const formAgentSessionsMiddleware = { listenerMiddleware, registerListeners }
