import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AppCatalogEntry } from "./app-catalog.models"
import { listAppCatalog } from "./app-catalog.thunks"

interface State {
  data: AsyncData<AppCatalogEntry[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "appCatalog",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAppCatalog.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAppCatalog.fulfilled, (state, action) => {
        state.data = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listAppCatalog.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list the apps catalog"
      })
  },
})

export const appCatalogActions = { ...slice.actions }
export const appCatalogSlice = slice
