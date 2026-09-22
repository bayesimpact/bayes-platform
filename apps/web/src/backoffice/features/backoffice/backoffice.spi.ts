import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import type {
  AppManifest,
  BackofficeAgentDetail,
  BackofficeOrganization,
  BackofficeOrganizationDetail,
  BackofficeProjectDetail,
  BackofficeRbacCatalog,
  BackofficeUserDetail,
  CreateAppManifestInput,
  PaginatedBackofficeAgents,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
  UpdateAppManifestInput,
  UpdateTermsDocumentsInput,
} from "./backoffice.models"

export interface IBackofficeSpi {
  listOrganizations: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeOrganizations>
  getOrganization: (organizationId: string) => Promise<BackofficeOrganizationDetail>
  createOrganization: (params: { name: string }) => Promise<BackofficeOrganization>
  listAgents: (params: {
    page?: number
    limit?: number
    search?: string
  }) => Promise<PaginatedBackofficeAgents>
  getAgent: (agentId: string) => Promise<BackofficeAgentDetail>
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
  getRbacCatalog: () => Promise<BackofficeRbacCatalog>
  addFeatureFlag: (params: { projectId: string; featureFlagKey: FeatureFlagKey }) => Promise<void>
  removeFeatureFlag: (params: {
    projectId: string
    featureFlagKey: FeatureFlagKey
  }) => Promise<void>

  listTermsDocuments: () => Promise<TermsDocuments>
  updateTermsDocuments: (input: UpdateTermsDocumentsInput) => Promise<TermsDocuments>
  listAppManifests: () => Promise<AppManifest[]>
  createAppManifest: (input: CreateAppManifestInput) => Promise<AppManifest>
  updateAppManifest: (params: {
    appManifestId: string
    input: UpdateAppManifestInput
  }) => Promise<AppManifest>
  deleteAppManifest: (appManifestId: string) => Promise<void>
}
