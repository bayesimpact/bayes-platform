import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import { selectCurrentAgentData } from "../../agents.selectors"
import { selectCurrentAgentSessionId } from "../current-agent-session-id/current-agent-session-id.selectors"
import type { FormAgentSession } from "./form-agent-sessions.models"

const selectFormAgentSessionsData = (state: RootState) => state.formAgentSessions.data

const missingAgentId = { status: ADS.Error, value: null, error: "No Agent selected" }
const missingAgentSessions = {
  status: ADS.Error,
  value: null,
  error: "No agent sessions available",
}

export const selectCurrentFormAgentSessionsData = createSelector(
  [selectCurrentAgentData, selectFormAgentSessionsData],
  (agent, data): AsyncData<FormAgentSession[]> => {
    if (!ADS.isFulfilled(agent)) return { ...agent }
    const currentAgentSessions = data[agent.value.id]
    if (!currentAgentSessions) return missingAgentSessions
    return currentAgentSessions
  },
)

export const selectCurrentFormAgentSessionsDataFromAgentId = (agentId?: string | null) =>
  createSelector([selectFormAgentSessionsData], (data): AsyncData<FormAgentSession[]> => {
    if (!agentId) return missingAgentId
    if (!data[agentId]) return missingAgentSessions

    const agentSessions = data[agentId]
    if (!agentSessions) return missingAgentSessions

    return agentSessions
  })

export const selectCurrentFormAgentSessionData = createSelector(
  [selectCurrentFormAgentSessionsData, selectCurrentAgentSessionId],
  (sessions, agentSessionId): AsyncData<FormAgentSession> => {
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
        error: "Form agent session not found in current Agent",
      }

    return { status: ADS.Fulfilled, value: agentSession, error: null }
  },
)
