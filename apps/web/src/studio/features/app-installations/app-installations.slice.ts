import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AppInstallation } from "./app-installations.models"
import { listAppInstallations, revokeProjectAppInstallation } from "./app-installations.thunks"

interface State {
  data: AsyncData<AppInstallation[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "appInstallations",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAppInstallations.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAppInstallations.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listAppInstallations.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list connected apps"
      })
      .addCase(revokeProjectAppInstallation.fulfilled, (state, action) => {
        if (!ADS.isFulfilled(state.data)) return
        const { appInstallationId } = action.meta.arg
        state.data.value = state.data.value.filter(
          (appInstallation) => appInstallation.id !== appInstallationId,
        )
      })
  },
})

export const appInstallationsActions = { ...slice.actions }
export const appInstallationsSlice = slice
