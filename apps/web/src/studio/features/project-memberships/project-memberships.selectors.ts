import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { ProjectMembership } from "./project-memberships.models"

export const selectProjectMemberships = (state: RootState) => state.projectMemberships.data

export const selectProjectMembershipsStatus = (state: RootState) =>
  state.projectMemberships.data.status

export const selectMemberRoles = (state: RootState) => state.projectMemberships.memberRoles

export const selectProjectPendingInvitations = (state: RootState) =>
  state.projectMemberships.pendingInvitations

export const selectAssignableRoles = (state: RootState) => state.projectMemberships.assignableRoles

export const selectCurrentProjectMemberUserId = (state: RootState) => state.currentIds.memberUserId

export const selectCurrentProjectMembership = createSelector(
  [selectProjectMemberships, selectCurrentProjectMemberUserId],
  (memberships, memberUserId): AsyncData<ProjectMembership> => {
    if (!memberUserId) return { status: ADS.Uninitialized, error: null, value: null }

    const membership = memberships.value?.find((m) => m.userId === memberUserId) ?? null
    if (!membership) return { status: ADS.Error, error: "Membership not found", value: null }

    return { status: ADS.Fulfilled, error: null, value: membership }
  },
)
