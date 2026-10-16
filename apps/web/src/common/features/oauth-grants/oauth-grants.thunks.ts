import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import type { OAuthGrant } from "./oauth-grants.models"

type ThunkConfig = {
  state: RootState
  extra: ThunkExtraArg
  rejectValue: string
}

export const listOAuthGrants = createAsyncThunk<OAuthGrant[], void, ThunkConfig>(
  "oauthGrants/list",
  async (_, { extra: { services }, rejectWithValue }) => {
    try {
      return await services.oauthGrants.getAll()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "Connected apps could not be loaded"))
    }
  },
)

/** Resolves with the id of the revoked grant. */
export const revokeOAuthGrant = createAsyncThunk<string, string, ThunkConfig>(
  "oauthGrants/revoke",
  async (grantId, { extra: { services }, rejectWithValue }) => {
    try {
      await services.oauthGrants.deleteOne(grantId)
      return grantId
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "Access could not be revoked"))
    }
  },
)
