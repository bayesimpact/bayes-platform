import type { RootState } from "@/common/store"

export const selectBackofficeOrganizations = (state: RootState) =>
  state.backoffice.backoffice.organizations
export const selectBackofficeUsers = (state: RootState) => state.backoffice.backoffice.users

export const selectTermsDocuments = (state: RootState) => state.backoffice.backoffice.termsDocuments
