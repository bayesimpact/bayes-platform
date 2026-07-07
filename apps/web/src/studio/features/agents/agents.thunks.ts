import type {
  CreateAgentDto,
  PartialUpdateAgentDto,
  UpdateAgentCategoriesDto,
  UpdateAgentGeneralDto,
  UpdateAgentModelDto,
  UpdateAgentOutputDto,
  UpdateAgentResourcesDto,
  UpdateAgentSourcesDto,
} from "@caseai-connect/api-contracts"
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

/**
 * Each agent editor tab owns its own save. Tabs dispatch the matching thunk below with only
 * their own fields; the API applies a partial update (see `partialUpdateAgentSchema`). The agent
 * list is refetched by the studio agents middleware on `*.fulfilled`.
 */
const patchAgent = async (
  agentId: string,
  fields: PartialUpdateAgentDto,
  { services, state }: { services: ThunkExtraArg["services"]; state: RootState },
): Promise<void> => {
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  await services.agents.updateOne({ organizationId, projectId, agentId }, fields)
}

export const updateAgentGeneral = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentGeneralDto },
  ThunkConfig
>("agents/updateGeneral", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})

export const updateAgentModel = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentModelDto },
  ThunkConfig
>("agents/updateModel", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})

export const updateAgentOutput = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentOutputDto },
  ThunkConfig
>("agents/updateOutput", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})

export const updateAgentSources = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSourcesDto },
  ThunkConfig
>("agents/updateSources", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})

export const updateAgentResources = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentResourcesDto },
  ThunkConfig
>("agents/updateResources", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})

export const updateAgentCategories = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentCategoriesDto },
  ThunkConfig
>("agents/updateCategories", async ({ agentId, fields }, { extra: { services }, getState }) => {
  await patchAgent(agentId, fields, { services, state: getState() })
})
