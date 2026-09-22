import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AppInstallPage } from "./app-install.models"
import { fetchInstallPage } from "./app-install.thunks"

interface State {
  slug: string | null
  redirectUri: string
  callbackState: string
  page: AsyncData<AppInstallPage>
}

const initialState: State = {
  slug: null,
  redirectUri: "",
  callbackState: "",
  page: defaultAsyncData,
}

const slice = createSlice({
  name: "appInstall",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => initialState,
    setCurrentIds: (
      state,
      action: PayloadAction<{ slug: string | null; redirectUri: string; callbackState: string }>,
    ) => {
      state.slug = action.payload.slug
      state.redirectUri = action.payload.redirectUri
      state.callbackState = action.payload.callbackState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInstallPage.pending, (state) => {
        if (!ADS.isFulfilled(state.page)) state.page.status = ADS.Loading
        state.page.error = null
      })
      .addCase(fetchInstallPage.fulfilled, (state, action) => {
        state.page = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(fetchInstallPage.rejected, (state, action) => {
        state.page.status = ADS.Error
        state.page.error = action.error.message || "Failed to load the install page"
      })
  },
})

export type { State as AppInstallState }
export const appInstallInitialState = initialState
export const appInstallActions = { ...slice.actions }
export const appInstallSlice = slice
