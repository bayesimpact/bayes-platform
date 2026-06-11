import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import type {
  BackofficeProjectSessionCategory,
  PaginatedBackofficeOrganizations,
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
  listUsers: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeUsers>
  addFeatureFlag: (params: { projectId: string; featureFlagKey: FeatureFlagKey }) => Promise<void>
  removeFeatureFlag: (params: {
    projectId: string
    featureFlagKey: FeatureFlagKey
  }) => Promise<void>
  replaceProjectSessionCategories: (params: {
    projectId: string
    categoryNames: string[]
  }) => Promise<BackofficeProjectSessionCategory[]>

  listTermsDocuments: () => Promise<TermsDocuments>
  updateTermsDocuments: (input: UpdateTermsDocumentsInput) => Promise<TermsDocuments>
}
