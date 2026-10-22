import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { listInvitationsForTarget } from "@/studio/features/invitations/invitations.thunks"
import type { ProjectRole } from "@/studio/features/project-memberships/project-memberships.models"
import type { AgentMembership } from "./agent-memberships.models"
import { agentMembershipsThunks } from "./agent-memberships.thunks"

interface State {
  data: AsyncData<AgentMembership[]>
  pendingInvitations: AsyncData<PendingInvitations>
  /** The roles a member can be given on the agent. */
  assignableRoles: AsyncData<ProjectRole[]>
}

const initialState: State = {
  data: defaultAsyncData,
  pendingInvitations: defaultAsyncData,
  assignableRoles: defaultAsyncData,
}

const slice = createSlice({
  name: "agentMemberships",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(agentMembershipsThunks.list.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(agentMembershipsThunks.list.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(agentMembershipsThunks.list.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list agent memberships"
      })

    builder
      .addCase(agentMembershipsThunks.listAssignableRoles.pending, (state) => {
        if (!ADS.isFulfilled(state.assignableRoles)) state.assignableRoles.status = ADS.Loading
        state.assignableRoles.error = null
      })
      .addCase(agentMembershipsThunks.listAssignableRoles.fulfilled, (state, action) => {
        state.assignableRoles = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(agentMembershipsThunks.listAssignableRoles.rejected, (state, action) => {
        state.assignableRoles.status = ADS.Error
        state.assignableRoles.error = action.error.message || "Failed to list the agent roles"
      })

    builder
      .addCase(listInvitationsForTarget.pending, (state, action) => {
        if (action.meta.arg.targetType !== "agent") return
        if (!ADS.isFulfilled(state.pendingInvitations)) {
          state.pendingInvitations.status = ADS.Loading
        }
        state.pendingInvitations.error = null
      })
      .addCase(listInvitationsForTarget.fulfilled, (state, action) => {
        if (action.meta.arg.targetType !== "agent") return
        state.pendingInvitations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listInvitationsForTarget.rejected, (state, action) => {
        if (action.meta.arg.targetType !== "agent") return
        state.pendingInvitations.status = ADS.Error
        state.pendingInvitations.error =
          action.error.message || "Failed to list agent pending invitations"
      })
  },
})

export type { State as AgentMembershipsState }
export const agentMembershipsInitialState = initialState
export const agentMembershipsActions = { ...slice.actions, ...agentMembershipsThunks }
export const agentMembershipsSlice = slice
