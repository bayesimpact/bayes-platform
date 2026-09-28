import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  ProjectEmbeddingModel,
  ProjectEmbeddingModelProgressEvent,
} from "./project-embedding-models.models"
import { listProjectEmbeddingModels } from "./project-embedding-models.thunks"

interface State {
  data: AsyncData<ProjectEmbeddingModel[]>
  progressStream: { isActive: boolean }
}

const initialState: State = {
  data: defaultAsyncData,
  progressStream: { isActive: false },
}

const slice = createSlice({
  name: "projectEmbeddingModels",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    startProgressStream: (state) => {
      state.progressStream.isActive = true
    },
    stopProgressStream: (state) => {
      state.progressStream.isActive = false
    },
    patchProgress: (state, action: PayloadAction<ProjectEmbeddingModelProgressEvent>) => {
      if (!ADS.isFulfilled(state.data)) return
      const model = state.data.value.find(
        (candidate) => candidate.id === action.payload.projectEmbeddingModelId,
      )
      if (!model) return
      if (model.updatedAt > action.payload.updatedAt) return
      model.status = action.payload.status
      model.totalChunks = action.payload.totalChunks
      model.processedChunks = action.payload.processedChunks
      model.error = action.payload.error
      model.updatedAt = action.payload.updatedAt
    },
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
