import type { RootState } from "@/common/store"

export const selectBackofficeOrganizations = (state: RootState) => state.backoffice.organizations
export const selectBackofficeOrganizationsQuery = (state: RootState) =>
  state.backoffice.organizationsQuery
export const selectBackofficeUsers = (state: RootState) => state.backoffice.users
export const selectBackofficeUsersQuery = (state: RootState) => state.backoffice.usersQuery
export const selectTermsDocuments = (state: RootState) => state.backoffice.termsDocuments
