import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, defaultAsyncData } from "@/common/store/async-data-status"
import { selectCurrentAgentData } from "../../agents.selectors"
import type { ExtractionAgentSessionSummary } from "./extraction-agent-sessions.models"

const selectExtractionAgentSessionsData = (state: RootState) => state.extractionAgentSessions.data

export const selectIsExtractionSessionStatusStreamActive = (state: RootState) =>
  state.extractionAgentSessions.sessionStatusStream.isActive

export const selectIsExtracting = createSelector(
  [selectCurrentAgentData, selectExtractionAgentSessionsData],
  (agent, data) => {
    if (!ADS.isFulfilled(agent)) return false
    return data[agent.value.id]?.isExtracting ?? false
  },
)

export const selectHasExtractionSessionsInProgress = createSelector(
  [selectCurrentAgentData, selectExtractionAgentSessionsData],
  (agent, data): boolean => {
    if (!ADS.isFulfilled(agent)) return false
    const slot = data[agent.value.id]
    if (!slot) return false
    if (slot.isExtracting) return true
    if (!ADS.isFulfilled(slot.sessions)) return false
    return slot.sessions.value.others.some((session) => session.status === "pending")
  },
)

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

export const selectCurrentExtractionRunId = (state: RootState) => state.currentIds.extractionRunId

export const selectCurrentExtractionRunData = createSelector(
  [selectCurrentExtractionAgentSessionsData, selectCurrentExtractionRunId],
  (
    sessionsData,
    runId,
  ): typeof defaultAsyncData & { value: ExtractionAgentSessionSummary | null } => {
    if (!runId) return defaultAsyncData
    if (ADS.isFulfilled(sessionsData)) {
      const run = sessionsData.value.others.find((session) => session.id === runId)
      if (!run) return { status: ADS.Error, value: null, error: "Extraction run not found" }
      return { status: ADS.Fulfilled, value: run, error: null }
    }
    if (ADS.isError(sessionsData)) {
      return { status: ADS.Error, value: null, error: sessionsData.error ?? "Failed to load run" }
    }
    return { status: ADS.Loading, value: null, error: null }
  },
)
