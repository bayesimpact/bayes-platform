import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"

import type {
  BackofficeOrganization,
  BackofficeProjectAgentCategory,
  BackofficeUser,
  TermsDocuments,
  UpdateTermsDocumentsInput,
} from "./backoffice.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const listOrganizations = createAsyncThunk<BackofficeOrganization[], void, ThunkConfig>(
  "backoffice/fetchOrganizations",
  async (_, { extra: { services } }) => {
    return services.backoffice.listOrganizations()
  },
)

const listUsers = createAsyncThunk<BackofficeUser[], void, ThunkConfig>(
  "backoffice/fetchUsers",
  async (_, { extra: { services } }) => {
    return services.backoffice.listUsers()
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

const replaceProjectAgentCategories = createAsyncThunk<
  { projectId: string; categories: BackofficeProjectAgentCategory[] },
  { projectId: string; categoryNames: string[] },
  ThunkConfig
>("backoffice/replaceProjectAgentCategories", async (params, { extra: { services } }) => {
  const categories = await services.backoffice.replaceProjectAgentCategories(params)
  return { projectId: params.projectId, categories }
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
  listUsers,
  addFeatureFlag,
  removeFeatureFlag,
  replaceProjectAgentCategories,
  listTermsDocuments,
  updateTermsDocuments,
}
