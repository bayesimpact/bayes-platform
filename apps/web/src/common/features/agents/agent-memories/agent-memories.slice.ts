import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentMemory } from "./agent-memories.models"
import {
  clearAgentMemories,
  deleteAgentMemory,
  listAgentMemories,
  resolveAgentMemoryProposals,
} from "./agent-memories.thunks"

interface State {
  /** True while a conversation of an agent with memory is open. */
  mounted: boolean
  data: AsyncData<AgentMemory[]>
}

const initialState: State = {
  mounted: false,
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentMemories",
  initialState,
  reducers: {
    mount: (state) => {
      state.mounted = true
    },
    unmount: () => initialState,
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgentMemories.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgentMemories.fulfilled, (state, action) => {
        state.data = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listAgentMemories.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load the agent's memory"
      })
      .addCase(deleteAgentMemory.fulfilled, (state, action) => {
        if (!ADS.isFulfilled(state.data)) return
        state.data.value = state.data.value.filter(
          (memory) => memory.id !== action.meta.arg.memoryId,
        )
      })
      .addCase(clearAgentMemories.fulfilled, (state) => {
        state.data = { status: ADS.Fulfilled, error: null, value: [] }
      })
      .addCase(resolveAgentMemoryProposals.fulfilled, (state, action) => {
        if (!ADS.isFulfilled(state.data)) return
        const answeredIds = new Set(action.meta.arg.decisions.map((decision) => decision.memoryId))
        const savedById = new Map(action.payload.map((memory) => [memory.id, memory]))
        // Saved proposals take their new content and status; rejected ones are gone.
        state.data.value = state.data.value.flatMap((memory) => {
          if (!answeredIds.has(memory.id)) return [memory]
          const saved = savedById.get(memory.id)
          return saved ? [saved] : []
        })
      })
  },
})

export type { State as AgentMemoriesState }
export const agentMemoriesInitialState = initialState
export const agentMemoriesActions = { ...slice.actions }
export const agentMemoriesSlice = slice
