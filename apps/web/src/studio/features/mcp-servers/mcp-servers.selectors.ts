import type { RootState } from "@/common/store"

export const selectMcpServersData = (state: RootState) => state.mcpServers.data
