import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AppInstallPage, ProjectAppInstallation } from "./app-install.models"
import {
  fetchInstallPage,
  fetchProjectInstallations,
  revokeAppInstallation,
} from "./app-install.thunks"

interface State {
  slug: string | null
  redirectUri: string
  callbackState: string
  page: AsyncData<AppInstallPage>
  projectInstallations: AsyncData<ProjectAppInstallation[]>
}

const initialState: State = {
  slug: null,
  redirectUri: "",
  callbackState: "",
  page: defaultAsyncData,
  projectInstallations: defaultAsyncData,
}

const slice = createSlice({
  name: "appInstall",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => initialState,
    clearProjectInstallations: (state) => {
      state.projectInstallations = defaultAsyncData
    },
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
      .addCase(fetchProjectInstallations.pending, (state) => {
        if (!ADS.isFulfilled(state.projectInstallations)) {
          state.projectInstallations.status = ADS.Loading
        }
        state.projectInstallations.error = null
      })
      .addCase(fetchProjectInstallations.fulfilled, (state, action) => {
        state.projectInstallations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(fetchProjectInstallations.rejected, (state, action) => {
        state.projectInstallations = {
          status: ADS.Error,
          error: action.payload || "Failed to load app installations",
          value: null,
        }
      })
      .addCase(revokeAppInstallation.fulfilled, (state, action) => {
        if (!ADS.isFulfilled(state.projectInstallations)) return
        state.projectInstallations.value = state.projectInstallations.value.filter(
          (installation) => installation.id !== action.payload,
        )
      })
  },
})

export type { State as AppInstallState }
export const appInstallInitialState = initialState
export const appInstallActions = { ...slice.actions }
export const appInstallSlice = slice
