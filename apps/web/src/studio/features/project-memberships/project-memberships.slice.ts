import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { listInvitationsForTarget } from "@/studio/features/invitations/invitations.thunks"
import type { AssignableRoles, MemberRoles, ProjectMembership } from "./project-memberships.models"
import {
  addProjectMemberRoles,
  listAssignableRoles,
  listProjectMemberships,
  loadMemberRoles,
  removeProjectMembers,
} from "./project-memberships.thunks"

interface State {
  data: AsyncData<ProjectMembership[]>
  /** The current member's roles on the workspace, its agents and its campaigns. */
  memberRoles: AsyncData<MemberRoles>
  pendingInvitations: AsyncData<PendingInvitations>
  /** The roles a member can be given on the workspace, an agent or a review campaign. */
  assignableRoles: AsyncData<AssignableRoles>
}

const initialState: State = {
  data: defaultAsyncData,
  memberRoles: defaultAsyncData,
  pendingInvitations: defaultAsyncData,
  assignableRoles: defaultAsyncData,
}

const slice = createSlice({
  name: "projectMemberships",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    memberMount: () => {},
    memberUnmount: (state) => {
      state.memberRoles = defaultAsyncData
    },
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

    builder.addCase(addProjectMemberRoles.fulfilled, (state, action) => {
      if (ADS.isFulfilled(state.data)) {
        const updatedByUserId = new Map(action.payload.map((member) => [member.userId, member]))
        state.data.value = state.data.value.map(
          (membership) => updatedByUserId.get(membership.userId) ?? membership,
        )
      }
    })

    builder.addCase(removeProjectMembers.fulfilled, (state, action) => {
      if (ADS.isFulfilled(state.data)) {
        const removedUserIds = new Set(action.meta.arg.memberUserIds)
        state.data.value = state.data.value.filter(
          (membership) => !removedUserIds.has(membership.userId),
        )
      }
    })

    builder
      .addCase(listAssignableRoles.pending, (state) => {
        if (!ADS.isFulfilled(state.assignableRoles)) state.assignableRoles.status = ADS.Loading
        state.assignableRoles.error = null
      })
      .addCase(listAssignableRoles.fulfilled, (state, action) => {
        state.assignableRoles = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listAssignableRoles.rejected, (state, action) => {
        state.assignableRoles.status = ADS.Error
        state.assignableRoles.error = action.error.message || "Failed to list the assignable roles"
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
      .addCase(loadMemberRoles.pending, (state) => {
        if (!ADS.isFulfilled(state.memberRoles)) state.memberRoles.status = ADS.Loading
        state.memberRoles.error = null
      })
      .addCase(loadMemberRoles.fulfilled, (state, action) => {
        state.memberRoles = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(loadMemberRoles.rejected, (state, action) => {
        state.memberRoles.status = ADS.Error
        state.memberRoles.error = action.error.message || "Failed to load the member's roles"
      })
  },
})

export const projectMembershipsActions = { ...slice.actions }
export const projectMembershipsSlice = slice
