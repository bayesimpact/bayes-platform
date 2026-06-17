import type { RootState } from "@/common/store"

export const selectBackofficeOrganizations = (state: RootState) => state.backoffice.organizations
export const selectBackofficeOrganizationsQuery = (state: RootState) =>
  state.backoffice.organizationsQuery
export const selectBackofficeProjects = (state: RootState) => state.backoffice.projects
export const selectBackofficeProjectsQuery = (state: RootState) => state.backoffice.projectsQuery
export const selectBackofficeProjectDetail = (state: RootState) => state.backoffice.projectDetail
export const selectBackofficeUsers = (state: RootState) => state.backoffice.users
export const selectBackofficeUsersQuery = (state: RootState) => state.backoffice.usersQuery
export const selectBackofficeUserDetail = (state: RootState) => state.backoffice.userDetail
export const selectTermsDocuments = (state: RootState) => state.backoffice.termsDocuments
