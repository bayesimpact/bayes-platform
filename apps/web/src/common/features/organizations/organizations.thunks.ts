import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Organization } from "./organizations.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const createOrganization = createAsyncThunk<Organization, { name: string }, ThunkConfig>(
  "organizations/create",
  async (payload, { extra: { services } }) => await services.organizations.createOne(payload),
)

export const updateOrganization = createAsyncThunk<
  void,
  { organizationId: string; name: string; onSuccess?: () => void },
  ThunkConfig
>(
  "organizations/update",
  async ({ organizationId, name }, { extra: { services } }) =>
    await services.organizations.updateOne({ organizationId }, { name }),
)
