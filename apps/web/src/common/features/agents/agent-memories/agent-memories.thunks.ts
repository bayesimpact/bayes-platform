import { createAsyncThunk } from "@reduxjs/toolkit"
import { buildType } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentMemory, AgentMemoryDecision } from "./agent-memories.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

/**
 * The memory the conversation view shows: the current agent's facts about the
 * signed-in user, for the session type of this interface (Studio runs
 * playground sessions, Desk runs live ones).
 */
function memoryScope(state: RootState) {
  return {
    organizationId: getCurrentId({ state, name: "organizationId" }),
    projectId: getCurrentId({ state, name: "projectId" }),
    agentId: getCurrentId({ state, name: "agentId" }),
    sessionType: buildType(),
  } as const
}

export const listAgentMemories = createAsyncThunk<AgentMemory[], void, ThunkConfig>(
  "agentMemories/list",
  async (_, { extra: { services }, getState }) =>
    services.agentMemories.getAll(memoryScope(getState())),
)

export const deleteAgentMemory = createAsyncThunk<void, { memoryId: string }, ThunkConfig>(
  "agentMemories/deleteOne",
  async ({ memoryId }, { extra: { services }, getState }) => {
    await services.agentMemories.deleteOne({ ...memoryScope(getState()), memoryId })
  },
)

export const clearAgentMemories = createAsyncThunk<void, void, ThunkConfig>(
  "agentMemories/deleteAll",
  async (_, { extra: { services }, getState }) => {
    await services.agentMemories.deleteAll(memoryScope(getState()))
  },
)

export const resolveAgentMemoryProposals = createAsyncThunk<
  AgentMemory[],
  { decisions: AgentMemoryDecision[] },
  ThunkConfig
>("agentMemories/resolveProposals", async ({ decisions }, { extra: { services }, getState }) =>
  services.agentMemories.resolveProposals(memoryScope(getState()), decisions),
)
