import { createAsyncThunk } from "@reduxjs/toolkit"
import { isAxiosError } from "axios"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Me } from "./me.models"

type FetchMeRejectedValue = {
  status?: number
  /** Error message of the API, when it sent one. */
  message?: string
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
        const message: unknown = error.response?.data?.message
        return rejectWithValue({
          status: error.response?.status,
          message: typeof message === "string" ? message : undefined,
        })
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

export const acceptTerms = createAsyncThunk<
  void,
  { aiUsagePolicyAccepted: boolean; onSuccess: () => void },
  ThunkConfig
>("termsAcceptance/accept", async (params, { extra: { services } }) => {
  await services.me.acceptTerms(params)
  params.onSuccess()
})
