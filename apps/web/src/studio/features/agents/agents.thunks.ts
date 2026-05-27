import type { CreateAgentDto, UpdateAgentDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { listAgents } from "@/common/features/agents/agents.thunks"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../../../common/features/helpers"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const createAgent = createAsyncThunk<
  Agent,
  { fields: CreateAgentDto; onSuccess?: (agent: Agent) => void },
  ThunkConfig
>("agents/create", async ({ fields }, { extra: { services }, getState, dispatch }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  const agent = await services.agents.createOne(params, fields)
  await dispatch(listAgents())
  return agent
})

export const updateAgent = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentDto },
  ThunkConfig
>("agents/update", async ({ agentId, fields }, { extra: { services }, getState, dispatch }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  await services.agents.updateOne({ ...params, agentId }, fields)
  await dispatch(listAgents())
  return
})

export const deleteAgent = createAsyncThunk<void, { agentId: string }, ThunkConfig>(
  "agents/delete",
  async ({ agentId }, { extra: { services }, getState, dispatch }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    await services.agents.deleteOne({ ...params, agentId })
    await dispatch(listAgents())
    return
  },
)
