import type { RootState } from "@/common/store"

export const selectAgentHistoryData = (state: RootState) => state.agentHistory.data
