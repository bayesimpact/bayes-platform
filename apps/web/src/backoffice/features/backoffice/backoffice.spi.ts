import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import type {
  BackofficeOrganizationDetail,
  BackofficeProjectDetail,
  BackofficeUserDetail,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
  UpdateTermsDocumentsInput,
} from "./backoffice.models"

export interface IBackofficeSpi {
  listOrganizations: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeOrganizations>
  getOrganization: (organizationId: string) => Promise<BackofficeOrganizationDetail>
  listProjects: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeProjects>
  getProject: (projectId: string) => Promise<BackofficeProjectDetail>
  listUsers: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeUsers>
  getUser: (userId: string) => Promise<BackofficeUserDetail>
  addFeatureFlag: (params: { projectId: string; featureFlagKey: FeatureFlagKey }) => Promise<void>
  removeFeatureFlag: (params: {
    projectId: string
    featureFlagKey: FeatureFlagKey
  }) => Promise<void>

  listTermsDocuments: () => Promise<TermsDocuments>
  updateTermsDocuments: (input: UpdateTermsDocumentsInput) => Promise<TermsDocuments>
}
