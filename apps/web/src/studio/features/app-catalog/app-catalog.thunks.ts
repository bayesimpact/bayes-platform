import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { hasFeatureOrThrow } from "@/common/hooks/use-feature-flags"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AppCatalogEntry } from "./app-catalog.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAppCatalog = createAsyncThunk<AppCatalogEntry[], void, ThunkConfig>(
  "appCatalog/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    hasFeatureOrThrow({ state, feature: "apps-catalog" })
    return await services.appCatalog.getAll({
      organizationId: getCurrentId({ state, name: "organizationId" }),
      projectId: getCurrentId({ state, name: "projectId" }),
    })
  },
)
