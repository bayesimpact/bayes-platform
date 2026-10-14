import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { OAuthGrant } from "./oauth-grants.models"
import { listOAuthGrants, revokeOAuthGrant } from "./oauth-grants.thunks"

interface State {
  grants: AsyncData<OAuthGrant[]>
}

const initialState: State = {
  grants: defaultAsyncData,
}

const slice = createSlice({
  name: "oauthGrants",
  initialState,
  reducers: {
    /** The connected apps dialog opened: the middleware reloads the grants. */
    mount: () => {},
    // The last list stays while the dialog is closed and is refreshed at the next opening.
    unmount: () => {},
  },
  extraReducers: (builder) => {
    builder
      .addCase(listOAuthGrants.pending, (state) => {
        if (!ADS.isFulfilled(state.grants)) state.grants.status = ADS.Loading
        state.grants.error = null
      })
      .addCase(listOAuthGrants.fulfilled, (state, action) => {
        state.grants = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(listOAuthGrants.rejected, (state, action) => {
        state.grants = {
          status: ADS.Error,
          error: action.payload || "Connected apps could not be loaded",
          value: null,
        }
      })
      .addCase(revokeOAuthGrant.fulfilled, (state, action) => {
        if (!state.grants.value) return
        state.grants.value = state.grants.value.filter((grant) => grant.id !== action.payload)
      })
  },
})

export type { State as OAuthGrantsState }
export const oauthGrantsInitialState = initialState
export const oauthGrantsActions = { ...slice.actions }
export const oauthGrantsSlice = slice
