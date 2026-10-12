import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AppInstallation } from "./app-installations.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAppInstallations = createAsyncThunk<AppInstallation[], void, ThunkConfig>(
  "appInstallations/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    return await services.appInstallations.getAll({
      organizationId: getCurrentId({ state, name: "organizationId" }),
      projectId: getCurrentId({ state, name: "projectId" }),
    })
  },
)
