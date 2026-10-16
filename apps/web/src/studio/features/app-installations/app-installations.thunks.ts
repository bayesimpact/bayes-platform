import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import type { AppInstallation } from "./app-installations.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg; rejectValue: string }

const currentProjectScope = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const listAppInstallations = createAsyncThunk<AppInstallation[], void, ThunkConfig>(
  "appInstallations/list",
  async (_, { extra: { services }, getState }) => {
    return await services.appInstallations.getAll(currentProjectScope(getState()))
  },
)

export const revokeProjectAppInstallation = createAsyncThunk<
  void,
  { appInstallationId: string },
  ThunkConfig
>(
  "appInstallations/revoke",
  async ({ appInstallationId }, { extra: { services }, getState, rejectWithValue }) => {
    try {
      await services.appInstallations.revokeOne({
        ...currentProjectScope(getState()),
        appInstallationId,
      })
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)
