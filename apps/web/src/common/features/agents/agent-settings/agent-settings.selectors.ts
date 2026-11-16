import { createSelector } from "@reduxjs/toolkit"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import {
  findDraftVersion,
  findProductionVersion,
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

      // Everything comes from the history alone. The agents list and the history load with two
      // requests: after a save that creates or deletes the draft, the list can name a revision the
      // history does not hold, or miss one it holds. Reading the list first would then find no
      // settings and take the editor off the screen while the user types.
      //
      // With the draft, the editor works on the newest revision: the draft, else the newest saved
      // one, which the next edit starts from. It is not the production revision when the managers
      // keep an older one live. Without the draft, the production revision, else the draft of an
      // agent never saved, such as a fresh copy.
      const versions = agentHistoryData.value
      const productionRevision = agent.currentRevision?.number
      const production =
        (productionRevision === undefined
          ? undefined
          : findVersion(versions, productionRevision)) ?? findProductionVersion(versions)
      const currentSettings = includeDraft
        ? versions[0]
        : (production ?? findDraftVersion(versions))

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
