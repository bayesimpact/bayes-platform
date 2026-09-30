import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentMembership } from "./agent-memberships.models"
import { agentMembershipsThunks } from "./agent-memberships.thunks"

interface State {
  data: AsyncData<AgentMembership[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentMemberships",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(agentMembershipsThunks.list.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(agentMembershipsThunks.list.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(agentMembershipsThunks.list.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list agent memberships"
      })

    builder.addCase(agentMembershipsThunks.remove.fulfilled, (state, action) => {
      if (ADS.isFulfilled(state.data)) {
        const { membershipId } = action.meta.arg
        state.data.value = state.data.value.filter((membership) => membership.id !== membershipId)
      }
    })
  },
})

export type { State as AgentMembershipsState }
export const agentMembershipsInitialState = initialState
export const agentMembershipsActions = { ...slice.actions, ...agentMembershipsThunks }
export const agentMembershipsSlice = slice
