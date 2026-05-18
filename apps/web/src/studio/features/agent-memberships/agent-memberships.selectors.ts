import type { RootState } from "@/common/store"

export const selectAgentMemberships = (state: RootState) => state.studio.agentMemberships.data

export const selectAgentMembershipsStatus = (state: RootState) =>
  state.studio.agentMemberships.data.status

export const selectAgentPendingInvitations = (state: RootState) =>
  state.studio.agentMemberships.pendingInvitations
