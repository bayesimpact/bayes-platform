import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Agent } from "./agents.models"

export const selectAgentsData = (state: RootState) => state.agents.data

export const selectCurrentAgentId = (state: RootState) => state.currentIds.agentId

export const selectCurrentAgentData = createSelector(
  [selectAgentsData, selectCurrentAgentId],
  (agentsData, agentId): AsyncData<Agent> => {
    if (!agentId) return { status: ADS.Error, value: null, error: "No Agent selected" }
    if (!ADS.isFulfilled(agentsData)) return { ...agentsData }
    const agent = agentsData.value.find((cb) => cb.id === agentId)
    if (!agent)
      return { status: ADS.Error, value: null, error: "Agent not found in current project" }
    return { status: ADS.Fulfilled, value: agent, error: null }
  },
)

export const hasAgentChanged = (prev: RootState, next: RootState) => {
  if (!prev.currentIds || !next.currentIds) return false
  const prevId = selectCurrentAgentId(prev)
  const nextId = selectCurrentAgentId(next)
  return prevId !== nextId && !!nextId
}
