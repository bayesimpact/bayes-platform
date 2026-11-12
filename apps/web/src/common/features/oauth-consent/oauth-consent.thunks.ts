import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getApiErrorMessage, isApiConflict } from "@/common/utils/api-error"
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

/**
 * Why an approval failed. `alreadyInstalled` is the API's 409: someone installed the app on the
 * workspace after the page loaded, and the notification says so in the person's language.
 */
export type ApproveOAuthConsentError = { message: string; alreadyInstalled: boolean }

export const approveOAuthConsent = createAsyncThunk<
  ApproveOAuthConsentResult,
  ApproveOAuthConsentInput,
  Omit<ThunkConfig, "rejectValue"> & { rejectValue: ApproveOAuthConsentError }
>("oauthConsent/approve", async (input, { extra: { services }, rejectWithValue }) => {
  try {
    return await services.oauthConsent.approve(input)
  } catch (error) {
    return rejectWithValue({
      message: getApiErrorMessage(error, "Access could not be granted"),
      alreadyInstalled: isApiConflict(error),
    })
  }
})
