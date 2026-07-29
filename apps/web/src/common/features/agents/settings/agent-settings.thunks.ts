import type { UpdateAgentSettingsDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentSettings } from "./agent-settings.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgentSettings = createAsyncThunk<
  AgentSettings[],
  { agentId: string },
  ThunkConfig
>("agentSettings/list", async ({ agentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.agentSettings.getAll({ organizationId, projectId, agentId })
})

export const updateAgentSettings = createAsyncThunk<
  AgentSettings,
  {
    agentId: string
    fields: UpdateAgentSettingsDto
    /** Set when this dispatch is part of a composite save that will notify on its own behalf. */
    silent?: boolean
  },
  ThunkConfig
>("agentSettings/update", async ({ agentId, fields }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.agentSettings.updateOne({ organizationId, projectId, agentId }, fields)
})

export const publishAgentSettings = createAsyncThunk<
  AgentSettings,
  {
    agentId: string
    revision: number
    revisionName?: string | null
    revisionDesc?: string | null
  },
  ThunkConfig
>(
  "agentSettings/publish",
  async ({ agentId, revision, revisionName, revisionDesc }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.agentSettings.publishOne(
      { organizationId, projectId, agentId, revision },
      { revisionName, revisionDesc },
    )
  },
)

export const restoreAgentSettings = createAsyncThunk<
  void,
  { agentId: string; revision: number },
  ThunkConfig
>("agentSettings/restore", async ({ agentId, revision }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  await services.agentSettings.restoreOne({ organizationId, projectId, agentId, revision })
})
