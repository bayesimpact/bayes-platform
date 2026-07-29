import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"

// Single-slot state holds one agent's revisions at a time. `listAgentSettings.pending` sets
// `agentId` to the newly requested agent immediately, but `data` stays fulfilled with the
// previous agent's revisions until the request resolves, so there is a window where
// `agentId` and `data.value` disagree. Data is only trustworthy for agent X when the loaded
// slot is X: a consumer rendering a specific agent must compare that agent's id against
// either `selectAgentSettingsAgentId` or the `agentId` field carried on the returned
// revisions themselves before using them.

export const selectAgentSettingsData = (state: RootState) => state.agentSettings.data

export const selectAgentSettingsAgentId = (state: RootState) => state.agentSettings.agentId

export const selectLastAgentSettings = createSelector([selectAgentSettingsData], (data) =>
  ADS.isFulfilled(data) ? (data.value[0] ?? null) : null,
)

export const selectLastPublishedAgentSettings = createSelector([selectAgentSettingsData], (data) =>
  ADS.isFulfilled(data)
    ? (data.value.find((agentSettings) => !agentSettings.isDraft) ?? null)
    : null,
)
