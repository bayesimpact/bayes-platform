import { createSelector } from "@reduxjs/toolkit"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import {
  findDraftVersion,
  findPublishedVersion,
  findVersion,
  resolveEffectiveRevision,
} from "./agent-settings.functions"
import type { AgentSettings } from "./agent-settings.models"

const selectAgentSettingsHistoryData = (state: RootState) => state.agentSettings.history

const selectPlaygroundRevisions = (state: RootState) =>
  state.agentSettings.playgroundRevisionByAgentId

/** Changes each time a version is restored: the agent editor reloads its forms on it. */
export const selectAgentSettingsRestoreCount = (state: RootState) =>
  state.agentSettings.restoreCount

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

      // The draft comes from the history alone, and the published revision falls back on it.
      // The agents list and the history load with two requests: after a save that creates or
      // deletes the draft, the list can name a revision the history does not hold, or miss one
      // it holds. Reading the list first would then find no settings and take the editor off
      // the screen while the user types.
      const versions = agentHistoryData.value
      const publishedRevision = agent.currentRevision?.number
      const published =
        (publishedRevision === undefined ? undefined : findVersion(versions, publishedRevision)) ??
        findPublishedVersion(versions)
      const draft = findDraftVersion(versions)
      // An agent that was never published, such as a fresh copy, only has its draft.
      const currentSettings = includeDraft ? (draft ?? published) : (published ?? draft)

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

/**
 * Settings of the revision the playground runs — what a new playground session tests.
 * The `agentSettings` slice is only registered in the Studio store, so the inputs read it
 * defensively: on interfaces without the slice (e.g. the desk) this returns `null`, which
 * is the same as while the history is still loading.
 */
export const selectPlaygroundAgentSettings = ({ agentId }: { agentId: string }) =>
  createSelector(
    [
      (state: RootState) => state.agentSettings?.history,
      (state: RootState) => state.agentSettings?.playgroundRevisionByAgentId,
    ],
    (history, revisionByAgentId): AgentSettings | null => {
      if (!history || !revisionByAgentId) return null
      const agentHistory = history[agentId]
      if (!agentHistory || !ADS.isFulfilled(agentHistory)) return null

      const revision = resolveEffectiveRevision({
        versions: agentHistory.value,
        chosenRevision: revisionByAgentId[agentId],
      })
      if (revision === undefined) return null

      return agentHistory.value.find((settings) => settings.revision === revision) ?? null
    },
  )
