import type { RootState } from "@/common/store"
import { SUPER_ROLES } from "./me.models"

export const selectMe = (state: RootState) => state.me.data
export const selectMeStatus = (state: RootState) => state.me.data.status
export const selectMeError = (state: RootState) => state.me.data.error

export const selectPendingInvitations = (state: RootState) => state.me.pendingInvitations

export const selectCanViewTraces = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("trace.read") ?? false

export const selectIsBackofficeAuthorized = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.read") ?? false

export const selectIsTermsManagementAuthorized = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.terms.update") ?? false

export const selectIsAppManagementAuthorized = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.app.manage") ?? false

export const selectCanInstallApps = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("app.install") ?? false

export const selectTermsAccepted = (state: RootState): boolean =>
  state.me.data.value?.termsAccepted ?? false

export const selectCurrentTerms = (state: RootState) => state.me.currentTerms

export const selectCanCreateOrganization = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("organization.create") ?? false

export const selectOrganizationMemberships = (state: RootState) =>
  state.me.data.value?.memberships.organizationMemberships

export const selectProjectMemberships = (state: RootState) =>
  state.me.data.value?.memberships.projectMemberships

export const selectAgentMemberships = (state: RootState) =>
  state.me.data.value?.memberships.agentMemberships

export const selectReviewCampaignMemberships = (state: RootState) =>
  state.me.data.value?.memberships.reviewCampaignMemberships

export const selectCanAccessStudioForOrganizationId =
  (organizationId: string) =>
  (state: RootState): boolean => {
    const memberships = state.me.data.value?.memberships
    if (!memberships) return false
    return memberships.organizationMemberships.some(
      (membership) =>
        membership.organizationId === organizationId && SUPER_ROLES.includes(membership.role),
    )
  }

/**
 * Review-campaign memberships available from the app switcher. Mirrors the
 * `listMyCampaigns` server filter: testers only see active campaigns, while
 * reviewers keep read access on closed campaigns.
 */
export const selectMyAccessibleReviewCampaignMemberships =
  (role: "tester" | "reviewer") => (state: RootState) => {
    const memberships = state.me.data.value?.memberships.reviewCampaignMemberships
    if (!memberships) return []
    return memberships.filter((membership) => {
      if (membership.role !== role) return false
      if (role === "reviewer") return membership.campaignStatus !== "draft"
      return membership.campaignStatus === "active"
    })
  }
