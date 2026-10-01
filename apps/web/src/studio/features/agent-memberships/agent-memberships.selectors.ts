import type { RootState } from "@/common/store"

export const selectAgentMemberships = (state: RootState) => state.agentMemberships.data

export const selectAgentMembershipsStatus = (state: RootState) => state.agentMemberships.data.status

export const selectAgentPendingInvitations = (state: RootState) =>
  state.agentMemberships.pendingInvitations
