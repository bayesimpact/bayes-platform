import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import type {
  AppInstallPage,
  AuthorizeAppInstallInput,
  AuthorizeAppInstallResult,
  ProjectAppInstallation,
} from "./app-install.models"

type ThunkConfig = {
  state: RootState
  extra: ThunkExtraArg
  rejectValue: string
}

export const fetchInstallPage = createAsyncThunk<AppInstallPage, string, ThunkConfig>(
  "appInstall/fetchPage",
  async (slug, { extra: { services } }) => services.appInstall.getInstallPage(slug),
)

export const fetchProjectInstallations = createAsyncThunk<
  ProjectAppInstallation[],
  string,
  ThunkConfig
>("appInstall/listForProject", async (projectId, { extra: { services }, rejectWithValue }) => {
  try {
    return await services.appInstall.listForProject(projectId)
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, "Failed to load app installations"))
  }
})

export const revokeAppInstallation = createAsyncThunk<string, string, ThunkConfig>(
  "appInstall/revoke",
  async (installationId, { extra: { services }, rejectWithValue }) => {
    try {
      await services.appInstall.revoke(installationId)
      return installationId
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "Failed to revoke the app installation"))
    }
  },
)

export const authorizeAppInstall = createAsyncThunk<
  AuthorizeAppInstallResult,
  AuthorizeAppInstallInput,
  ThunkConfig
>("appInstall/authorize", async (input, { extra: { services }, rejectWithValue }) => {
  try {
    return await services.appInstall.authorize(input)
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, "App installation failed"))
  }
})
