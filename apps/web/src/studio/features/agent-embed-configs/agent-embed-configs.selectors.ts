import type { RootState } from "@/common/store"

export const selectAgentEmbedConfig = (state: RootState) => state.agentEmbedConfigs.data

export const selectAgentEmbedConfigStatus = (state: RootState) =>
  state.agentEmbedConfigs.data.status
