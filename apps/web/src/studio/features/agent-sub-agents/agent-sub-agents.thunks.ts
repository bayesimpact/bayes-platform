import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { hasFeatureOrThrow } from "@/common/hooks/use-feature-flags"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentSubAgent, ReplaceAgentSubAgent } from "./agent-sub-agents.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const list = createAsyncThunk<AgentSubAgent[], void, ThunkConfig>(
  "agentSubAgents/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    hasFeatureOrThrow({ state, feature: "agent-orchestration" })
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.agentSubAgents.getAll({ organizationId, projectId, agentId })
  },
)

const updateAll = createAsyncThunk<
  AgentSubAgent[],
  { subAgents: ReplaceAgentSubAgent[] },
  ThunkConfig
>("agentSubAgents/updateAll", async ({ subAgents }, { extra: { services }, getState }) => {
  const state = getState()
  hasFeatureOrThrow({ state, feature: "agent-orchestration" })
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })
  return await services.agentSubAgents.updateAll(
    { organizationId, projectId, agentId },
    { subAgents },
  )
})

export const agentSubAgentsThunks = { list, updateAll }
