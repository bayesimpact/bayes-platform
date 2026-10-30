import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"
import { listProjectEmbeddingModels } from "./project-embedding-models.thunks"

interface State {
  data: AsyncData<ProjectEmbeddingModel[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "projectEmbeddingModels",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listProjectEmbeddingModels.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listProjectEmbeddingModels.fulfilled, (state, action) => {
        state.data = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listProjectEmbeddingModels.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list embedding models"
      })
  },
})

export const projectEmbeddingModelsActions = { ...slice.actions }
export const projectEmbeddingModelsSlice = slice
