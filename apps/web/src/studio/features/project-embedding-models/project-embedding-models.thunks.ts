import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const getScopeParams = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const listProjectEmbeddingModels = createAsyncThunk<
  ProjectEmbeddingModel[],
  void,
  ThunkConfig
>("projectEmbeddingModels/getAll", async (_, { extra: { services }, getState }) => {
  return await services.projectEmbeddingModels.getAll(getScopeParams(getState()))
})

export const enableProjectEmbeddingModel = createAsyncThunk<
  ProjectEmbeddingModel,
  { modelName: EmbeddingModel },
  ThunkConfig
>("projectEmbeddingModels/createOne", async ({ modelName }, { extra: { services }, getState }) => {
  return await services.projectEmbeddingModels.createOne({
    ...getScopeParams(getState()),
    modelName,
  })
})
