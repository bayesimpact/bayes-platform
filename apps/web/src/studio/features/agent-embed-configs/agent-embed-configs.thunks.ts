import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentIds } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentEmbedConfig } from "./agent-embed-configs.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const fetchConfig = createAsyncThunk<AgentEmbedConfig, void, ThunkConfig>(
  "agentEmbedConfigs/fetchConfig",
  async (_, { extra: { services }, getState }) => {
    const { organizationId, projectId, agentId } = getCurrentIds({
      state: getState(),
      wantedIds: ["organizationId", "projectId", "agentId"],
    })
    return await services.agentEmbedConfigs.getOne({ organizationId, projectId, agentId })
  },
)

const updateConfig = createAsyncThunk<
  void,
  { isEnabled: boolean; allowedOrigins: string[] },
  ThunkConfig
>(
  "agentEmbedConfigs/updateConfig",
  async ({ isEnabled, allowedOrigins }, { extra: { services }, getState }) => {
    const { organizationId, projectId, agentId } = getCurrentIds({
      state: getState(),
      wantedIds: ["organizationId", "projectId", "agentId"],
    })
    await services.agentEmbedConfigs.updateOne(
      { organizationId, projectId, agentId },
      { isEnabled, allowedOrigins },
    )
  },
)

export const agentEmbedConfigsThunks = { fetchConfig, updateConfig }
