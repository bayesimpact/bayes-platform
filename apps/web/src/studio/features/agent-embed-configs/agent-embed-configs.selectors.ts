import type { RootState } from "@/common/store"

export const selectAgentEmbedConfig = (state: RootState) => state.studio.agentEmbedConfigs.data

export const selectAgentEmbedConfigStatus = (state: RootState) =>
  state.studio.agentEmbedConfigs.data.status
