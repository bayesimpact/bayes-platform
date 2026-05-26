import { createSlice } from "@reduxjs/toolkit"
import { fetchMe } from "@/common/features/me/me.thunks"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Organization } from "./organizations.models"
import { createOrganization } from "./organizations.thunks"

interface State {
  data: AsyncData<Organization[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "organizations",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
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
          value: action.payload.organizations,
        }
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list organizations"
      })

    builder.addCase(createOrganization.pending, (state) => {
      if (!ADS.isFulfilled(state.data) || state.data.value?.length === 0) {
        // Required when no org yet
        state.data.status = ADS.Loading
      }
    })
  },
})

export const organizationsActions = { ...slice.actions }
export const organizationsSlice = slice
