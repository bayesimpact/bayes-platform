import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { selectCurrentAgentData } from "../../agents.selectors"

const selectExtractionAgentSessionsData = (state: RootState) => state.extractionAgentSessions.data

export const selectIsExtracting = createSelector(
  [selectCurrentAgentData, selectExtractionAgentSessionsData],
  (agent, data) => {
    if (!ADS.isFulfilled(agent)) return false
    return data[agent.value.id]?.isExtracting ?? false
  },
)

export const selectLastExtractionSession = (state: RootState) => {
  const data = selectCurrentExtractionAgentSessionsData(state)
  if (!ADS.isFulfilled(data)) return null

  const sessions = data.value
  if (!sessions || sessions.others.length === 0) return null

  return sessions.others.reduce((latest, session) => {
    return new Date(session.createdAt) > new Date(latest.createdAt) ? session : latest
  })
}

export const selectExtractionAgentSessionsDocuments = (state: RootState) =>
  state.extractionAgentSessions.documents

const missingAgentId = { status: ADS.Error, value: null, error: "No agent selected" }
const missingAgentSessions = {
  status: ADS.Error,
  value: null,
  error: "No agent sessions available",
}

export const selectCurrentExtractionAgentSessionsData = createSelector(
  [selectCurrentAgentData, selectExtractionAgentSessionsData],
  (agent, data) => {
    if (!ADS.isFulfilled(agent)) return { ...agent }
    const slot = data[agent.value.id]
    if (!slot) return missingAgentSessions
    return slot.sessions
  },
)

export const selectExtractionAgentSessionsFromAgentId = (agentId?: string | null) =>
  createSelector([selectExtractionAgentSessionsData], (data) => {
    if (!agentId) return missingAgentId
    const slot = data[agentId]
    if (!slot) return missingAgentSessions
    return slot.sessions
  })
