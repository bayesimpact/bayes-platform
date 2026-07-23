import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Organization } from "./organizations.models"
import { createOrganization, fetchOrganizations } from "./organizations.thunks"

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
      .addCase(fetchOrganizations.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(fetchOrganizations.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list organizations"
      })

    builder.addCase(createOrganization.pending, (state) => {
      if (!ADS.isFulfilled(state.data) || state.data.value?.length === 0) {
        state.data.status = ADS.Loading
      }
    })
  },
})

export const organizationsActions = { ...slice.actions }
export const organizationsSlice = slice
