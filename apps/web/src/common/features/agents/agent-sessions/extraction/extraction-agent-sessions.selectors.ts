import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import { selectCurrentAgentData } from "../../agents.selectors"
import type { ExtractionAgentSessionSummary } from "./extraction-agent-sessions.models"

export const selectExtractionAgentSessionsData = (state: RootState) =>
  state.extractionAgentSessions.data
export const selectIsProcessingExecution = (state: RootState) =>
  state.extractionAgentSessions.isProcesssingExecution
export const selectLastExtractionSession = (state: RootState) => {
  const data = selectCurrentExtractionAgentSessionsData(state)
  if (!ADS.isFulfilled(data)) return null

  const sessions = data.value
  if (!sessions || sessions.length === 0) return null

  return sessions.reduce((latest, session) => {
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

export const selectExtractionAgentSessionsFromAgentId = (agentId?: string | null) =>
  createSelector(
    [selectExtractionAgentSessionsData],
    (runsData): AsyncData<ExtractionAgentSessionSummary[]> => {
      if (!agentId) return missingAgentId

      if (!ADS.isFulfilled(runsData)) return { ...runsData }

      const value = runsData.value?.[agentId]
      if (!value) return { status: ADS.Fulfilled, value: [], error: null }

      return { status: ADS.Fulfilled, value, error: null }
    },
  )

export const selectCurrentExtractionAgentSessionsData = createSelector(
  [selectCurrentAgentData, selectExtractionAgentSessionsData],
  (agentData, sessionsData): AsyncData<ExtractionAgentSessionSummary[]> => {
    if (!ADS.isFulfilled(agentData)) return { ...agentData }

    if (!ADS.isFulfilled(sessionsData)) return { ...sessionsData }

    const value = sessionsData.value[agentData.value.id]
    if (!value) return missingAgentSessions

    return { status: ADS.Fulfilled, value, error: null }
  },
)
