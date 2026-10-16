import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { OAuthAuthorizationRequest, OAuthConsentPage } from "./oauth-consent.models"
import { fetchOAuthConsentPage } from "./oauth-consent.thunks"
import { parseOAuthAuthorizationRequest } from "./oauth-consent.utils"

interface State {
  /** Query string the request was read from, null until the route sets it. */
  search: string | null
  /** Parsed authorization request, null when the query string is malformed. */
  request: OAuthAuthorizationRequest | null
  page: AsyncData<OAuthConsentPage>
}

const initialState: State = {
  search: null,
  request: null,
  page: defaultAsyncData,
}

const slice = createSlice({
  name: "oauthConsent",
  initialState,
  reducers: {
    mount: () => {},
    unmount: (state) => {
      state.page = defaultAsyncData
    },
    setRequest: (state, action: PayloadAction<{ search: string }>) => {
      state.search = action.payload.search
      state.request = parseOAuthAuthorizationRequest(action.payload.search)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOAuthConsentPage.pending, (state) => {
        if (!ADS.isFulfilled(state.page)) state.page.status = ADS.Loading
        state.page.error = null
      })
      .addCase(fetchOAuthConsentPage.fulfilled, (state, action) => {
        state.page = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(fetchOAuthConsentPage.rejected, (state, action) => {
        state.page = {
          status: ADS.Error,
          error: action.payload || "This authorization request is invalid",
          value: null,
        }
      })
  },
})

export type { State as OAuthConsentState }
export const oauthConsentInitialState = initialState
export const oauthConsentActions = { ...slice.actions }
export const oauthConsentSlice = slice
