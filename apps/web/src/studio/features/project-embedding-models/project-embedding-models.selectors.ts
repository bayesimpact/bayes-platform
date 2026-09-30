import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"

const NO_MODELS: ProjectEmbeddingModel[] = []

export const selectProjectEmbeddingModelsData = (state: RootState) =>
  state.projectEmbeddingModels.data

/** The enabled models, or an empty list while nothing is loaded (the flag may be off). */
export const selectProjectEmbeddingModels = createSelector(
  [selectProjectEmbeddingModelsData],
  (data) => (ADS.isFulfilled(data) ? data.value : NO_MODELS),
)

export const selectCompletedProjectEmbeddingModels = createSelector(
  [selectProjectEmbeddingModels],
  (models) => models.filter((model) => model.status === "completed"),
)

export const selectHasProjectEmbeddingModelsInProgress = createSelector(
  [selectProjectEmbeddingModels],
  (models) => models.some((model) => model.status === "pending" || model.status === "processing"),
)
