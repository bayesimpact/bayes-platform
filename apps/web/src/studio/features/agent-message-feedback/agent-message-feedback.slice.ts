import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { AgentMessageFeedback } from "./agent-message-feedback.models"
import { listAgentMessageFeedbacks } from "./agent-message-feedback.thunks"

type DataType = Record<Agent["id"], AgentMessageFeedback[]> // keyed by agentId
interface State {
  currentFeedbackId: string | null
  data: AsyncData<DataType>
}

const initialState: State = {
  currentFeedbackId: null,
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "agentMessageFeedback",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    setCurrentFeedbackId: (state, action: PayloadAction<{ feedbackId: string | null }>) => {
      state.currentFeedbackId = action.payload.feedbackId
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listAgentMessageFeedbacks.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listAgentMessageFeedbacks.fulfilled, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: {
            ...state.data.value,
            [agentId]: action.payload,
          },
        }
      })
      .addCase(listAgentMessageFeedbacks.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list feedbacks"
      })
  },
})

export type { State as AgentMessageFeedbackState }
export const agentMessageFeedbackInitialState = initialState
export const agentMessageFeedbackActions = { ...slice.actions }
export const agentMessageFeedbackSlice = slice
