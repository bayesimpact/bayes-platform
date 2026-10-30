import type { RootState } from "@/common/store"

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

export const selectIsMaintenanceJobRunAuthorized = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.maintenance_job.run") ?? false

/** Whether the user was granted the safety review of this agent. No role stands in for it. */
export const selectCanReviewConversationsOfAgent =
  (agentId: string | null) =>
  (state: RootState): boolean =>
    agentId !== null && (state.me.data.value?.conversationReviewAgentIds.includes(agentId) ?? false)

export const selectCanUpdateConversationReviewers = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.conversation_reviewer.update") ??
  false

export const selectCanUpdateGlobalRoles = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("backoffice.global_role.update") ?? false

export const selectTermsAccepted = (state: RootState): boolean =>
  state.me.data.value?.termsAccepted ?? false

export const selectCurrentTerms = (state: RootState) => state.me.currentTerms

export const selectCanCreateOrganization = (state: RootState): boolean =>
  state.me.data.value?.globalPermissions.includes("organization.create") ?? false
