import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { ProjectMembership } from "./project-memberships.models"

export const selectProjectMemberships = (state: RootState) => state.projectMemberships.data

export const selectProjectMembershipsStatus = (state: RootState) =>
  state.projectMemberships.data.status

export const selectProjectMemberAgents = (state: RootState) => state.projectMemberships.memberAgents

export const selectProjectPendingInvitations = (state: RootState) =>
  state.projectMemberships.pendingInvitations

export const selectCurrentProjectMembershipId = (state: RootState) => state.currentIds.membershipId

export const selectCurrentProjectMembership = createSelector(
  [selectProjectMemberships, selectCurrentProjectMembershipId],
  (memberships, membershipId): AsyncData<ProjectMembership> => {
    if (!membershipId) return { status: ADS.Uninitialized, error: null, value: null }

    const membership = memberships.value?.find((m) => m.id === membershipId) ?? null
    if (!membership) return { status: ADS.Error, error: "Membership not found", value: null }

    return { status: ADS.Fulfilled, error: null, value: membership }
  },
)
