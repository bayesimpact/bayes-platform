import { createSelector } from "@reduxjs/toolkit"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import { resolveEffectiveRevision } from "./agent-settings.functions"
import type { AgentSettings } from "./agent-settings.models"

const selectAgentSettingsHistoryData = (state: RootState) => state.agentSettings.history

const selectPlaygroundRevisions = (state: RootState) =>
  state.agentSettings.playgroundRevisionByAgentId

// Current Agent settings by agent ID
export const selectAgentSettingsDataByAgentId = ({
  agentId,
  includeDraft = false,
}: {
  agentId: string
  includeDraft?: boolean
}) =>
  createSelector(
    [selectAgentsData, selectAgentSettingsHistoryData],
    (agentsData, data): AsyncData<AgentSettings> => {
      if (!agentId) return { status: ADS.Error, value: null, error: "No Agent selected" }

      const agentHistoryData = data[agentId]
      if (!agentHistoryData) return { status: ADS.Uninitialized, error: null, value: null }

      if (!ADS.isFulfilled(agentsData)) return { ...agentsData }
      const agent = agentsData.value.find((cb) => cb.id === agentId)
      if (!agent)
        return { status: ADS.Error, value: null, error: "Agent not found in current project" }

      if (!ADS.isFulfilled(agentHistoryData)) return { ...agentHistoryData }

      const isValid = agentHistoryData.value.some((settings) => settings.agentId === agent.id)
      if (!isValid) return { status: ADS.Error, error: "Agent settings not found", value: null }

      const currentSettings = agentHistoryData.value.find(
        (settings) =>
          settings.revision ===
          (includeDraft
            ? agent.draftRevision
              ? agent.draftRevision.number
              : agent.currentRevision.number
            : agent.currentRevision.number),
      )

      if (!currentSettings)
        return { status: ADS.Error, error: "Current agent settings not found", value: null }

      return { status: ADS.Fulfilled, error: null, value: currentSettings }
    },
  )

// Agent settings history by agent ID
export const selectAgentSettingsHistoryDataByAgentId = ({
  agentId,
  includeDraft = false,
}: {
  agentId: string
  includeDraft?: boolean
}) =>
  createSelector([selectAgentSettingsHistoryData], (data): AsyncData<AgentSettings[]> => {
    if (!agentId) return { status: ADS.Fulfilled, value: [], error: null } // on purpose

    const agentHistoryData = data[agentId]
    if (!agentHistoryData) return { status: ADS.Uninitialized, error: null, value: null }

    if (!ADS.isFulfilled(agentHistoryData)) return { ...agentHistoryData }

    const filteredSettings = includeDraft
      ? agentHistoryData.value
      : agentHistoryData.value.filter((settings) => !settings.isDraft)

    return { status: ADS.Fulfilled, error: null, value: filteredSettings }
  })

/**
 * Revision the playground runs new messages with for this session. `undefined` while the history
 * is still loading — callers must then send no revision and let the API apply its own default.
 */
export const selectPlaygroundRevision = ({ agentId }: { agentId: string }) =>
  createSelector(
    [selectAgentSettingsHistoryData, selectPlaygroundRevisions],
    (history, revisionByAgentId): number | undefined => {
      const agentHistory = history[agentId]
      if (!agentHistory || !ADS.isFulfilled(agentHistory)) return undefined

      return resolveEffectiveRevision({
        versions: agentHistory.value,
        chosenRevision: revisionByAgentId[agentId],
      })
    },
  )
