import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { ResourceLibrary } from "./resource-libraries.models"
import { listResourceLibraries } from "./resource-libraries.thunks"

interface State {
  data: AsyncData<ResourceLibrary[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "resourceLibraries",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listResourceLibraries.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listResourceLibraries.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listResourceLibraries.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list resource libraries"
      })
  },
})

export type { State as resourceLibrariesState }
export const resourceLibrariesInitialState = initialState
export const resourceLibrariesActions = { ...slice.actions }
export const resourceLibrariesSlice = slice
