import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { listInvitationsForTarget } from "@/studio/features/invitations/invitations.thunks"
import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"
import {
  listProjectMemberAgents,
  listProjectMemberships,
  removeProjectMembership,
} from "./project-memberships.thunks"

interface State {
  data: AsyncData<ProjectMembership[]>
  memberAgents: AsyncData<ProjectMemberAgent[]>
  pendingInvitations: AsyncData<PendingInvitations>
}

const initialState: State = {
  data: defaultAsyncData,
  memberAgents: defaultAsyncData,
  pendingInvitations: defaultAsyncData,
}

const slice = createSlice({
  name: "projectMemberships",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listProjectMemberships.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listProjectMemberships.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listProjectMemberships.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list project memberships"
      })

    builder.addCase(removeProjectMembership.fulfilled, (state, action) => {
      if (ADS.isFulfilled(state.data)) {
        const { membershipId } = action.meta.arg
        state.data.value = state.data.value.filter((membership) => membership.id !== membershipId)
      }
    })

    builder
      .addCase(listInvitationsForTarget.pending, (state, action) => {
        if (action.meta.arg.targetType !== "project") return
        if (!ADS.isFulfilled(state.pendingInvitations)) {
          state.pendingInvitations.status = ADS.Loading
        }
        state.pendingInvitations.error = null
      })
      .addCase(listInvitationsForTarget.fulfilled, (state, action) => {
        if (action.meta.arg.targetType !== "project") return
        state.pendingInvitations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listInvitationsForTarget.rejected, (state, action) => {
        if (action.meta.arg.targetType !== "project") return
        state.pendingInvitations.status = ADS.Error
        state.pendingInvitations.error =
          action.error.message || "Failed to list project pending invitations"
      })

    builder
      .addCase(listProjectMemberAgents.pending, (state) => {
        if (!ADS.isFulfilled(state.memberAgents)) state.memberAgents.status = ADS.Loading
        state.memberAgents.error = null
      })
      .addCase(listProjectMemberAgents.fulfilled, (state, action) => {
        state.memberAgents = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listProjectMemberAgents.rejected, (state, action) => {
        state.memberAgents.status = ADS.Error
        state.memberAgents.error = action.error.message || "Failed to list member agents"
      })
  },
})

export type { State as ProjectMembershipsState }
export const projectMembershipsInitialState = initialState
export const projectMembershipsActions = { ...slice.actions }
export const projectMembershipsSlice = slice
