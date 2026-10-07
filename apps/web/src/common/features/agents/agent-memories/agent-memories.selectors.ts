import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { AgentMemory } from "./agent-memories.models"

// The slice is injected in Studio and Desk only: other interfaces (tester)
// render the same messages without it, and get no memory UI.
export const selectAgentMemoriesData = (state: RootState): AsyncData<AgentMemory[]> | null =>
  state.agentMemories?.data ?? null

export const selectAgentMemoriesMounted = (state: RootState) =>
  state.agentMemories?.mounted ?? false

export const selectSavedAgentMemories = createSelector(
  [selectAgentMemoriesData],
  (data): AgentMemory[] =>
    data && ADS.isFulfilled(data) ? data.value.filter((memory) => memory.status === "saved") : [],
)

/** Current status of each fact, by id: what the approval card shows for its proposals. */
export const selectAgentMemoryStatusById = createSelector(
  [selectAgentMemoriesData],
  (data): Record<string, AgentMemory["status"]> | null =>
    data && ADS.isFulfilled(data)
      ? Object.fromEntries(data.value.map((memory) => [memory.id, memory.status]))
      : null,
)
