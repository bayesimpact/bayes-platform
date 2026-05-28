import type { RootState } from "@/common/store"

export const selectAgentSubAgentsData = (state: RootState) => state.agentSubAgents.data

export const selectAgentSubAgentsMounted = (state: RootState) => state.agentSubAgents.mounted
