import type {
  PartialUpdateAgentSettingsDto,
  UpdateAgentSettingsCategoriesDto,
  UpdateAgentSettingsGeneralDto,
  UpdateAgentSettingsModelDto,
  UpdateAgentSettingsOutputDto,
  UpdateAgentSettingsResourcesDto,
  UpdateAgentSettingsSourcesDto,
  UpdateAgentSettingsToolsDto,
} from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { updateAgent } from "@/studio/features/agents/agents.thunks"
import { selectCurrentAgentData } from "../agents.selectors"
import type { AgentSettings } from "./agent-settings.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgentSettings = createAsyncThunk<
  AgentSettings[],
  { agentId: string },
  ThunkConfig
>("agentSettings/getAll", async ({ agentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId, agentId }
  return await services.agentSettings.getAll(params)
})

export const restoreAgentSettings = createAsyncThunk<void, { revision: number }, ThunkConfig>(
  "agentSettings/restoreOne",
  async ({ revision }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.agentSettings.restoreOne({ organizationId, projectId, agentId, revision })
  },
)

export const createAgentSettings = createAsyncThunk<
  void,
  { revision: number; revisionName?: string; revisionDesc?: string; onSuccess: () => void },
  ThunkConfig
>("agentSettings/createOne", async (payload, { extra: { services }, getState }) => {
  const { revision, ...publishPayload } = payload
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })
  await services.agentSettings.createOne(
    { organizationId, projectId, agentId, revision },
    publishPayload,
  )
})

export const updateAgentSettings = createAsyncThunk<
  void,
  { agentId: string; fields: PartialUpdateAgentSettingsDto },
  ThunkConfig
>("agentSettings/updateOne", async (payload, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId, agentId: payload.agentId }

  await services.agentSettings.updateOne(params, payload.fields)
})

export const updateAgentSettingsGeneral = createAsyncThunk<
  void,
  { agentId: string; fields: Partial<UpdateAgentSettingsGeneralDto> },
  ThunkConfig
>("agentSettings/updateGeneral", async ({ agentId, fields }, { dispatch }) => {
  if (fields.name) {
    dispatch(updateAgent({ agentId, name: fields.name }))
  }
  delete fields.name // name is not part of agent settings, so we remove it before sending to the API

  if (Object.keys(fields).length === 0) return

  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsModel = createAsyncThunk<
  void,
  { agentId: string; fields: Partial<UpdateAgentSettingsModelDto> },
  ThunkConfig
>("agentSettings/updateModel", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsOutput = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsOutputDto },
  ThunkConfig
>("agentSettings/updateOutput", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsSources = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsSourcesDto },
  ThunkConfig
>("agentSettings/updateSources", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsResources = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsResourcesDto },
  ThunkConfig
>("agentSettings/updateResources", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsTools = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsToolsDto },
  ThunkConfig
>("agentSettings/updateTools", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const updateAgentSettingsCategories = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsCategoriesDto },
  ThunkConfig
>("agentSettings/updateCategories", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields }))
})

export const getFillFormOutputJsonSchema = createAsyncThunk<
  AgentSettings["outputJsonSchema"] | undefined,
  void,
  ThunkConfig
>("agents/getFillFormOutputJsonSchema", async (_, { extra: { services }, getState }) => {
  const state = getState()
  const agent = selectCurrentAgentData(state)
  if (!agent.value) throw new Error("No agent selected")
  const agentId = agent.value.id
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })

  const params = {
    organizationId,
    projectId,
    agentId,
    revision: agent.value.currentRevision.number,
  }
  return await services.agentSettings.getFillFormOutputJsonSchema(params)
})
