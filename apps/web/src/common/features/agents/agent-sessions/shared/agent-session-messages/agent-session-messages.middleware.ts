import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { selectCurrentConversationAgentSessionsData } from "../../conversation/conversation-agent-sessions.selectors"
import {
  hasAgentSessionChanged,
  selectCurrentAgentSessionId,
} from "../../current-agent-session-id/current-agent-session-id.selectors"
import { selectCurrentFormAgentSessionsData } from "../../form/form-agent-sessions.selectors"
import { listAgentSessionsForAgents } from "../base-agent-session/base-agent-sessions.thunks"
import { listMessages } from "./agent-session-messages.thunks"

// Create typed listener middleware
export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

const agentSessionTypeWithMessages = ["conversation", "form"] as const

function registerListeners() {
  // Refresh messages when current agent sessions are loaded and one is selected
  listenerMiddleware.startListening({
    matcher: isAnyOf(listAgentSessionsForAgents.fulfilled, listAgentSessionsForAgents.fulfilled),
    effect: async (action, listenerApi) => {
      // @ts-expect-error
      const { agentType } = action.meta.arg
      if (!agentSessionTypeWithMessages.includes(agentType)) return

      const state = listenerApi.getState()
      const agentSessionId = selectCurrentAgentSessionId(state)
      if (!agentSessionId) return
      await listenerApi.dispatch(listMessages(agentSessionId))
    },
  })

  // Refresh messages when current agent session changes
  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return hasAgentSessionChanged(originalState, currentState)
    },
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentSessionId = selectCurrentAgentSessionId(state)
      if (!agentSessionId) return

      const formAgentSessions = selectCurrentFormAgentSessionsData(state)
      const isFormAgentSession: boolean = ADS.isFulfilled(formAgentSessions)
        ? formAgentSessions.value.some((session) => session.id === agentSessionId)
        : false

      const conversationAgentSessions = selectCurrentConversationAgentSessionsData(state)
      const isConversationAgentSession: boolean = ADS.isFulfilled(conversationAgentSessions)
        ? conversationAgentSessions.value.some((session) => session.id === agentSessionId)
        : false

      if (!isFormAgentSession && !isConversationAgentSession) return

      await listenerApi.dispatch(listMessages(agentSessionId))
    },
  })
}

export const agentSessionMessagesMiddleware = {
  listenerMiddleware,
  registerListeners,
}
