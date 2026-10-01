import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { CurrentTerms, User } from "./me.models"
import { fetchMe } from "./me.thunks"

interface State {
  data: AsyncData<User>
  currentTerms: CurrentTerms | null
}

const initialState: State = {
  data: defaultAsyncData,
  currentTerms: null,
}

const slice = createSlice({
  name: "me",
  initialState,
  reducers: {
    mountOnboarding: () => {},
    unmountOnboarding: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload.user,
        }
        state.currentTerms = action.payload.currentTerms
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to fetch user data"
      })

    builder
  },
})

export type { State as MeState }
export const meInitialState = initialState
export const meActions = { ...slice.actions }
export const meSlice = slice
