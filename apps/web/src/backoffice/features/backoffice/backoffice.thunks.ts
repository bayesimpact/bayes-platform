import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"

import type {
  BackofficeProjectDetail,
  BackofficeUserDetail,
  PaginatedBackofficeOrganizations,
  PaginatedBackofficeProjects,
  PaginatedBackofficeUsers,
  TermsDocuments,
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

export const backofficeThunks = {
  listOrganizations,
  listProjects,
  getProject,
  listUsers,
  getUser,
  addFeatureFlag,
  removeFeatureFlag,
  listTermsDocuments,
  updateTermsDocuments,
}
