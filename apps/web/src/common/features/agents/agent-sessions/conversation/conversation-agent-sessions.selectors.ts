import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import { selectCurrentAgentData } from "../../agents.selectors"
import { selectCurrentAgentSessionId } from "../current-agent-session-id/current-agent-session-id.selectors"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "./conversation-agent-sessions.models"

const selectConversationAgentSessionsData = (state: RootState) =>
  state.conversationAgentSessions.data
const selectConversationSubSessionsData = (state: RootState) =>
  state.conversationAgentSessions.subSessions

const missingAgentId = { status: ADS.Error, value: null, error: "No Agent selected" }
const missingAgentSessions = {
  status: ADS.Error,
  value: null,
  error: "No agent sessions available",
}

export const selectCurrentConversationAgentSessionsData = createSelector(
  [selectCurrentAgentData, selectConversationAgentSessionsData],
  (agent, data): AsyncData<ConversationAgentSession[]> => {
    if (!ADS.isFulfilled(agent)) return { ...agent }
    const currentAgentSessions = data[agent.value.id]
    if (!currentAgentSessions) return missingAgentSessions
    return currentAgentSessions
  },
)

export const selectCurrentConversationAgentSessionsDataFromAgentId = (agentId?: string | null) =>
  createSelector(
    [selectConversationAgentSessionsData],
    (data): AsyncData<ConversationAgentSession[]> => {
      if (!agentId) return missingAgentId
      if (!data[agentId]) return missingAgentSessions

      const agentSessions = data[agentId]
      if (!agentSessions) return missingAgentSessions

      return agentSessions
    },
  )

const EMPTY_SUB_SESSIONS: ConversationSubSession[] = []

/**
 * Returns the sub-sessions delegated by the given parent agent session (for
 * fillForm-enabled sub-agents). Resolves to an empty array until the fetch is
 * fulfilled, so consumers can map over it unconditionally.
 */
export const selectConversationSubSessionsBySessionId = (sessionId?: string | null) =>
  createSelector([selectConversationSubSessionsData], (subSessions): ConversationSubSession[] => {
    if (!sessionId) return EMPTY_SUB_SESSIONS
    const entry = subSessions?.[sessionId]
    if (!entry || !ADS.isFulfilled(entry)) return EMPTY_SUB_SESSIONS
    return entry.value
  })

export const selectCurrentConversationAgentSessionData = createSelector(
  [selectCurrentConversationAgentSessionsData, selectCurrentAgentSessionId],
  (sessions, agentSessionId): AsyncData<ConversationAgentSession> => {
    if (!ADS.isFulfilled(sessions)) return { ...sessions }

    if (!agentSessionId) {
      // Return loading on purpose
      return { status: ADS.Loading, value: null, error: null }
    }

    const agentSession = sessions.value.find((cs) => cs.id === agentSessionId)

    if (!agentSession)
      return {
        status: ADS.Error,
        value: null,
        error: "Conversation agent session not found in current Agent",
      }

    return { status: ADS.Fulfilled, value: agentSession, error: null }
  },
)
