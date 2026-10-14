import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage } from "@/common/utils/api-error"
import type {
  ApproveOAuthConsentInput,
  ApproveOAuthConsentResult,
  OAuthAuthorizationRequest,
  OAuthConsentPage,
} from "./oauth-consent.models"

type ThunkConfig = {
  state: RootState
  extra: ThunkExtraArg
  rejectValue: string
}

export const fetchOAuthConsentPage = createAsyncThunk<
  OAuthConsentPage,
  OAuthAuthorizationRequest,
  ThunkConfig
>("oauthConsent/fetchPage", async (request, { extra: { services }, rejectWithValue }) => {
  try {
    return await services.oauthConsent.getConsentPage(request)
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, "This authorization request is invalid"))
  }
})

export const approveOAuthConsent = createAsyncThunk<
  ApproveOAuthConsentResult,
  ApproveOAuthConsentInput,
  ThunkConfig
>("oauthConsent/approve", async (input, { extra: { services }, rejectWithValue }) => {
  try {
    return await services.oauthConsent.approve(input)
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, "Access could not be granted"))
  }
})
