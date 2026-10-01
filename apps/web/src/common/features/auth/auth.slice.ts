import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface State {
  isLoading: boolean
  isAuthenticated: boolean
  /** Why the API refused this sign-in (see SIGN_IN_ERRORS), shown instead of logging out. */
  signInError: string | null
}

const initialState: State = {
  isLoading: true,
  isAuthenticated: false,
  signInError: null,
}

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload
    },
    setStopLoading: (state) => {
      state.isLoading = false
    },
    setSignInError: (state, action: PayloadAction<string>) => {
      state.signInError = action.payload
      state.isLoading = false
    },
  },
})

export type { State as AuthState }
export const authInitialState = initialState
export const authActions = { ...slice.actions }
export const authSlice = slice
