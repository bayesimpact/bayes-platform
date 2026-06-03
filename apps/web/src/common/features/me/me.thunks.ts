import { createAsyncThunk } from "@reduxjs/toolkit"
import { isAxiosError } from "axios"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import type { Me } from "./me.models"

type FetchMeRejectedValue = {
  status?: number
}

type ThunkConfig = {
  state: RootState
  extra: ThunkExtraArg
  rejectValue: FetchMeRejectedValue
}

export const fetchMe = createAsyncThunk<Me, void, ThunkConfig>(
  "me/fetch",
  async (_, { extra: { services }, rejectWithValue }) => {
    try {
      return await services.me.getMe()
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue({ status: error.response?.status })
      }
      throw error
    }
  },
)

export const fetchPendingInvitations = createAsyncThunk<PendingInvitations, void, ThunkConfig>(
  "me/fetchPendingInvitations",
  async (_, { extra: { services }, rejectWithValue }) => {
    try {
      return await services.invitations.listPendingMine()
    } catch (error) {
      if (isAxiosError(error)) {
        return rejectWithValue({ status: error.response?.status })
      }
      throw error
    }
  },
)

export const updateMe = createAsyncThunk<void, { name: string }, ThunkConfig>(
  "me/update",
  async (params, { extra: { services } }) => {
    await services.me.updateMe(params)
  },
)

export const acceptTerms = createAsyncThunk<void, { aiUsagePolicyAccepted: boolean }, ThunkConfig>(
  "termsAcceptance/accept",
  async (params, { extra: { services } }) => {
    await services.me.acceptTerms(params)
  },
)
