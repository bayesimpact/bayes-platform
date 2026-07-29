import type { AgentLocale, CreateAgentDto, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { updateAgentSettings } from "@/common/features/agents/settings/agent-settings.thunks"
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

export const renameAgent = createAsyncThunk<
  void,
  {
    agentId: string
    name: string
    /** Set when this dispatch is part of a composite save that will notify on its own behalf. */
    silent?: boolean
  },
  ThunkConfig
>("agents/rename", async ({ agentId, name }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  await services.agents.updateOne({ organizationId, projectId, agentId }, { name })
})

export const updateAgentDocumentTags = createAsyncThunk<
  void,
  {
    agentId: string
    documentTagIds: string[]
    /** Set when this dispatch is part of a composite save that will notify on its own behalf. */
    silent?: boolean
  },
  ThunkConfig
>(
  "agents/updateDocumentTags",
  async ({ agentId, documentTagIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.agents.updateDocumentTags(
      { organizationId, projectId, agentId },
      { documentTagIds },
    )
  },
)

export const updateAgentResourceLibraries = createAsyncThunk<
  void,
  { agentId: string; resourceLibraryIds: string[] },
  ThunkConfig
>(
  "agents/updateResourceLibraries",
  async ({ agentId, resourceLibraryIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.agents.updateResourceLibraries(
      { organizationId, projectId, agentId },
      { resourceLibraryIds },
    )
  },
)

export const updateAgentSessionCategories = createAsyncThunk<
  void,
  { agentId: string; projectAgentSessionCategoryIds: string[] },
  ThunkConfig
>(
  "agents/updateSessionCategories",
  async ({ agentId, projectAgentSessionCategoryIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.agents.updateSessionCategories(
      { organizationId, projectId, agentId },
      { projectAgentSessionCategoryIds },
    )
  },
)

/**
 * The General tab edits one agent field (name) and three settings fields, so it saves through
 * two endpoints. Settings go first: if the second call fails the agent row is untouched, and the
 * agentSettings middleware refetches both on rejected so the form shows the true state.
 */
export const saveAgentGeneral = createAsyncThunk<
  void,
  {
    agentId: string
    fields: {
      name?: string
      instructions?: string
      locale?: AgentLocale
      greetingMessage?: string | null
    }
  },
  ThunkConfig
>("agents/saveGeneral", async ({ agentId, fields }, { dispatch }) => {
  const { name, ...settingsFields } = fields
  if (Object.keys(settingsFields).length > 0) {
    // silent: true, since this composite thunk's own fulfilled/rejected owns the single
    // notification and the single listAgents() refetch (see agents.middleware.ts).
    await dispatch(updateAgentSettings({ agentId, fields: settingsFields, silent: true })).unwrap()
  }
  if (name !== undefined) {
    await dispatch(renameAgent({ agentId, name, silent: true })).unwrap()
  }
})

/** The Sources tab edits documentsRagMode (settings) and the tag set (agent). */
export const saveAgentSources = createAsyncThunk<
  void,
  { agentId: string; documentsRagMode?: DocumentsRagMode; documentTagIds?: string[] },
  ThunkConfig
>("agents/saveSources", async ({ agentId, documentsRagMode, documentTagIds }, { dispatch }) => {
  if (documentsRagMode !== undefined) {
    // silent: true, following saveAgentGeneral above (this composite thunk owns the notification).
    await dispatch(
      updateAgentSettings({ agentId, fields: { documentsRagMode }, silent: true }),
    ).unwrap()
  }
  if (documentTagIds !== undefined) {
    await dispatch(updateAgentDocumentTags({ agentId, documentTagIds, silent: true })).unwrap()
  }
})
