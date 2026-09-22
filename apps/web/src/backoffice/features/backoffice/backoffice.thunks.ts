import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"

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

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const listOrganizations = createAsyncThunk<
  PaginatedBackofficeOrganizations,
  { page?: number; limit?: number; search?: string } | undefined,
  ThunkConfig
>("backoffice/fetchOrganizations", async (params, { extra: { services } }) => {
  return services.backoffice.listOrganizations(params ?? {})
})

const createOrganization = createAsyncThunk<BackofficeOrganization, { name: string }, ThunkConfig>(
  "backoffice/createOrganization",
  async (params, { extra: { services } }) => {
    return services.backoffice.createOrganization(params)
  },
)

const getOrganization = createAsyncThunk<BackofficeOrganizationDetail, string, ThunkConfig>(
  "backoffice/getOrganization",
  async (organizationId, { extra: { services } }) => {
    return services.backoffice.getOrganization(organizationId)
  },
)

const listAgents = createAsyncThunk<
  PaginatedBackofficeAgents,
  { page?: number; limit?: number; search?: string } | undefined,
  ThunkConfig
>("backoffice/fetchAgents", async (params, { extra: { services } }) => {
  return services.backoffice.listAgents(params ?? {})
})

const getAgent = createAsyncThunk<BackofficeAgentDetail, string, ThunkConfig>(
  "backoffice/getAgent",
  async (agentId, { extra: { services } }) => {
    return services.backoffice.getAgent(agentId)
  },
)

const listProjects = createAsyncThunk<
  PaginatedBackofficeProjects,
  { page?: number; limit?: number; search?: string } | undefined,
  ThunkConfig
>("backoffice/fetchProjects", async (params, { extra: { services } }) => {
  return services.backoffice.listProjects(params ?? {})
})

const getProject = createAsyncThunk<BackofficeProjectDetail, string, ThunkConfig>(
  "backoffice/getProject",
  async (projectId, { extra: { services } }) => {
    return services.backoffice.getProject(projectId)
  },
)

const listUsers = createAsyncThunk<
  PaginatedBackofficeUsers,
  { page?: number; limit?: number; search?: string } | undefined,
  ThunkConfig
>("backoffice/fetchUsers", async (params, { extra: { services } }) => {
  return services.backoffice.listUsers(params ?? {})
})

const getUser = createAsyncThunk<BackofficeUserDetail, string, ThunkConfig>(
  "backoffice/getUser",
  async (userId, { extra: { services } }) => {
    return services.backoffice.getUser(userId)
  },
)

const getRbacCatalog = createAsyncThunk<BackofficeRbacCatalog, void, ThunkConfig>(
  "backoffice/getRbacCatalog",
  async (_, { extra: { services } }) => services.backoffice.getRbacCatalog(),
)

const addFeatureFlag = createAsyncThunk<
  { projectId: string; featureFlagKey: FeatureFlagKey },
  { projectId: string; featureFlagKey: FeatureFlagKey },
  ThunkConfig
>("backoffice/addFeatureFlag", async (params, { extra: { services } }) => {
  await services.backoffice.addFeatureFlag(params)
  return params
})

const removeFeatureFlag = createAsyncThunk<
  { projectId: string; featureFlagKey: FeatureFlagKey },
  { projectId: string; featureFlagKey: FeatureFlagKey },
  ThunkConfig
>("backoffice/removeFeatureFlag", async (params, { extra: { services } }) => {
  await services.backoffice.removeFeatureFlag(params)
  return params
})

const listTermsDocuments = createAsyncThunk<TermsDocuments, void, ThunkConfig>(
  "backoffice/listTermsDocuments",
  async (_, { extra: { services } }) => services.backoffice.listTermsDocuments(),
)

const updateTermsDocuments = createAsyncThunk<
  TermsDocuments,
  UpdateTermsDocumentsInput,
  ThunkConfig
>("backoffice/updateTermsDocuments", async (input, { extra: { services } }) =>
  services.backoffice.updateTermsDocuments(input),
)

const listAppManifests = createAsyncThunk<AppManifest[], void, ThunkConfig>(
  "backoffice/listAppManifests",
  async (_, { extra: { services } }) => services.backoffice.listAppManifests(),
)

const createAppManifest = createAsyncThunk<AppManifest, CreateAppManifestInput, ThunkConfig>(
  "backoffice/createAppManifest",
  async (input, { extra: { services } }) => services.backoffice.createAppManifest(input),
)

const updateAppManifest = createAsyncThunk<
  AppManifest,
  { appManifestId: string; input: UpdateAppManifestInput },
  ThunkConfig
>("backoffice/updateAppManifest", async (params, { extra: { services } }) =>
  services.backoffice.updateAppManifest(params),
)

const deleteAppManifest = createAsyncThunk<string, string, ThunkConfig>(
  "backoffice/deleteAppManifest",
  async (appManifestId, { extra: { services } }) => {
    await services.backoffice.deleteAppManifest(appManifestId)
    return appManifestId
  },
)

export const backofficeThunks = {
  listOrganizations,
  getOrganization,
  createOrganization,
  listAgents,
  getAgent,
  listProjects,
  getProject,
  listUsers,
  getUser,
  getRbacCatalog,
  addFeatureFlag,
  removeFeatureFlag,
  listTermsDocuments,
  updateTermsDocuments,
  listAppManifests,
  createAppManifest,
  updateAppManifest,
  deleteAppManifest,
}
