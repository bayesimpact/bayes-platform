import type { CreateAgentDto, DuplicateAgentDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../../../common/features/helpers"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const getScopeParams = (state: RootState) => {
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return { organizationId, projectId }
}

export const createAgent = createAsyncThunk<
  Agent,
  { fields: CreateAgentDto; onSuccess?: (agent: Agent) => void },
  ThunkConfig
>("agents/create", async ({ fields }, { extra: { services }, getState }) => {
  const state = getState()
  const params = getScopeParams(state)

  const agent = await services.agents.createOne(params, fields)
  return agent
})

export const duplicateAgent = createAsyncThunk<
  Agent,
  { agentId: string; fields: DuplicateAgentDto; onSuccess?: (agent: Agent) => void },
  ThunkConfig
>("agents/duplicate", async ({ agentId, fields }, { extra: { services }, getState }) => {
  const state = getState()
  const params = { ...getScopeParams(state), agentId }

  return await services.agents.duplicateOne(params, fields)
})

export const deleteAgent = createAsyncThunk<void, { agentId: string }, ThunkConfig>(
  "agents/delete",
  async ({ agentId }, { extra: { services }, getState }) => {
    const state = getState()
    const params = { ...getScopeParams(state), agentId }

    await services.agents.deleteOne(params)
  },
)

export const updateAgent = createAsyncThunk<void, { agentId: string; name: string }, ThunkConfig>(
  "agents/update",
  async ({ agentId, name }, { extra: { services }, getState }) => {
    const state = getState()
    const params = { ...getScopeParams(state), agentId }

    await services.agents.updateOne(params, { name })
  },
)
