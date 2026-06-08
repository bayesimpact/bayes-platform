import type { EmbedDisplayMode } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentEmbedConfig } from "./agent-embed-configs.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const fetchConfig = createAsyncThunk<AgentEmbedConfig, void, ThunkConfig>(
  "agentEmbedConfigs/fetchConfig",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.agentEmbedConfigs.getOne({ organizationId, projectId, agentId })
  },
)

type UpdateConfigPayload = {
  isEnabled: boolean
  allowedOrigins: string[]
  title?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  displayMode?: EmbedDisplayMode
}

const updateConfig = createAsyncThunk<void, UpdateConfigPayload, ThunkConfig>(
  "agentEmbedConfigs/updateConfig",
  async (
    { isEnabled, allowedOrigins, title, logoUrl, primaryColor, displayMode },
    { extra: { services }, getState },
  ) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.agentEmbedConfigs.updateOne(
      { organizationId, projectId, agentId },
      { isEnabled, allowedOrigins, title, logoUrl, primaryColor, displayMode },
    )
  },
)

export const agentEmbedConfigsThunks = { fetchConfig, updateConfig }
