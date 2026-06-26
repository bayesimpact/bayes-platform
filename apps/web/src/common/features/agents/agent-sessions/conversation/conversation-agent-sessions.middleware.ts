import { createListenerMiddleware } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { AppDispatch, RootState } from "@/common/store"
import { isStudioInterface } from "@/studio/routes/helpers"
import { formAgentSessionsActions } from "../form/form-agent-sessions.slice"
import { agentSessionMessagesActions } from "../shared/agent-session-messages/agent-session-messages.slice"
import { listMessages } from "../shared/agent-session-messages/agent-session-messages.thunks"
import { conversationAgentSessionsActions } from "./conversation-agent-sessions.slice"

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

// Streaming emits many chunks per second; debounce the sub-session refresh so
// it fires once the stream settles instead of on every chunk.
const SUB_SESSIONS_REFRESH_DEBOUNCE_MS = 500

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

      // The Studio session view surfaces form sub-agent results delegated by
      // this conversation session. Other interfaces don't render them, so skip
      // the extra fetch there.
      if (isStudioInterface()) {
        const agentId = getCurrentId({ state, name: "agentId" })
        await listenerApi.dispatch(
          formAgentSessionsActions.listSubSessions({ agentId, agentSessionId }),
        )
      }
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentSessionMessagesActions.appendAssistantChunk,
    effect: async (_, listenerApi) => {
      if (!isStudioInterface()) return

      // Collapse the burst of streaming chunks into a single refresh: cancel
      // any pending run and wait for the stream to settle before fetching.
      listenerApi.cancelActiveListeners()
      await listenerApi.delay(SUB_SESSIONS_REFRESH_DEBOUNCE_MS)

      const state = listenerApi.getState()
      const agentSessionId = getCurrentId({ state, name: "agentSessionId" })

      // The Studio session view surfaces form sub-agent results delegated by
      // this conversation session. Other interfaces don't render them, so skip
      // the extra fetch there.
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(
        formAgentSessionsActions.listSubSessions({ agentId, agentSessionId }),
      )
    },
  })
}

export const conversationAgentSessionsMiddleware = { listenerMiddleware, registerListeners }
