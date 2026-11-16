import type {
  PartialUpdateAgentSettingsDto,
  UpdateAgentSettingsCategoriesDto,
  UpdateAgentSettingsGeneralDto,
  UpdateAgentSettingsModelDto,
  UpdateAgentSettingsOutputDto,
  UpdateAgentSettingsSourcesDto,
  UpdateAgentSettingsToolsDto,
} from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import { updateAgent } from "@/studio/features/agents/agents.thunks"
import { selectCurrentAgentData } from "../agents.selectors"
import type { AgentSettings } from "./agent-settings.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgentSettingsWithDraft = createAsyncThunk<
  AgentSettings[],
  { agentId: string },
  ThunkConfig
>("agentSettings/getAllWithDraft", async ({ agentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId, agentId }
  return await services.agentSettings.getAllWithDraft(params)
})

export const restoreAgentSettings = createAsyncThunk<void, { revision: number }, ThunkConfig>(
  "agentSettings/restoreOne",
  async ({ revision }, { dispatch, extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.agentSettings.restoreOne({ organizationId, projectId, agentId, revision })
    // The editor reloads its forms when the restore is fulfilled: the restored settings must be
    // in the store by then.
    await dispatch(listAgentSettingsWithDraft({ agentId }))
  },
)

export const setProductionAgentSettings = createAsyncThunk<void, { revision: number }, ThunkConfig>(
  "agentSettings/setProduction",
  async ({ revision }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.agentSettings.setProduction({ organizationId, projectId, agentId, revision })
  },
)

export const createAgentSettings = createAsyncThunk<
  void,
  {
    revision: number
    revisionName?: string
    revisionDesc?: string
    setAsProduction?: boolean
    onSuccess: () => void
  },
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

// The tab thunks below unwrap this one: the editor saves by itself and must know when a save
// failed, to keep the change marked as unsaved. It rejects with the API's own message, so the
// editor can say why (a category that conversations already use, for example).
export const updateAgentSettings = createAsyncThunk<
  void,
  { agentId: string; fields: PartialUpdateAgentSettingsDto },
  ThunkConfig & { rejectValue: string }
>(
  "agentSettings/updateOne",
  async (payload, { extra: { services }, getState, rejectWithValue }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId, agentId: payload.agentId }

    try {
      await services.agentSettings.updateOne(params, payload.fields)
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)

export const updateAgentSettingsGeneral = createAsyncThunk<
  void,
  { agentId: string; fields: Partial<UpdateAgentSettingsGeneralDto> },
  ThunkConfig
>("agentSettings/updateGeneral", async ({ agentId, fields }, { dispatch }) => {
  // The name belongs to the agent, not to its settings: it has its own endpoint.
  const { name, ...settingsFields } = fields
  if (name) await dispatch(updateAgent({ agentId, name })).unwrap()

  if (Object.keys(settingsFields).length === 0) return

  await dispatch(updateAgentSettings({ agentId, fields: settingsFields })).unwrap()
})

export const updateAgentSettingsModel = createAsyncThunk<
  void,
  { agentId: string; fields: Partial<UpdateAgentSettingsModelDto> },
  ThunkConfig
>("agentSettings/updateModel", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields })).unwrap()
})

export const updateAgentSettingsOutput = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsOutputDto },
  ThunkConfig
>("agentSettings/updateOutput", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields })).unwrap()
})

export const updateAgentSettingsSources = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsSourcesDto },
  ThunkConfig
>("agentSettings/updateSources", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields })).unwrap()
})

export const updateAgentSettingsTools = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsToolsDto },
  ThunkConfig
>("agentSettings/updateTools", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields })).unwrap()
})

export const updateAgentSettingsCategories = createAsyncThunk<
  void,
  { agentId: string; fields: UpdateAgentSettingsCategoriesDto },
  ThunkConfig
>("agentSettings/updateCategories", async ({ agentId, fields }, { dispatch }) => {
  await dispatch(updateAgentSettings({ agentId, fields })).unwrap()
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
  // An agent that was never published has no form in live conversations yet.
  const revision = agent.value.currentRevision?.number
  if (revision === undefined) return undefined

  const params = { organizationId, projectId, agentId, revision }
  return await services.agentSettings.getFillFormOutputJsonSchema(params)
})
