import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { CurrentTerms, PendingInvitations, User } from "./me.models"
import { fetchMe, fetchPendingInvitations } from "./me.thunks"

interface State {
  data: AsyncData<User>
  currentTerms: CurrentTerms | null
  pendingInvitations: AsyncData<PendingInvitations>
}

const initialState: State = {
  data: defaultAsyncData,
  currentTerms: null,
  pendingInvitations: defaultAsyncData,
}

const slice = createSlice({
  name: "me",
  initialState,
  reducers: {
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
      .addCase(fetchPendingInvitations.pending, (state) => {
        if (!ADS.isFulfilled(state.pendingInvitations))
          state.pendingInvitations.status = ADS.Loading
        state.pendingInvitations.error = null
      })
      .addCase(fetchPendingInvitations.fulfilled, (state, action) => {
        state.pendingInvitations = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(fetchPendingInvitations.rejected, (state, action) => {
        state.pendingInvitations.status = ADS.Error
        state.pendingInvitations.error =
          action.error.message || "Failed to fetch pending invitations"
      })
  },
})

export type { State as MeState }
export const meInitialState = initialState
export const meActions = { ...slice.actions }
export const meSlice = slice
