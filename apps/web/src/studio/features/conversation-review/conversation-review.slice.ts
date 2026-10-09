import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { ConversationReview } from "./conversation-review.models"
import { loadConversationReview } from "./conversation-review.thunks"

interface State {
  review: AsyncData<ConversationReview>
}

const initialState: State = {
  review: defaultAsyncData,
}

const slice = createSlice({
  name: "conversationReview",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConversationReview.pending, (state) => {
        state.review = { status: ADS.Loading, error: null, value: null }
      })
      .addCase(loadConversationReview.fulfilled, (state, action) => {
        state.review = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(loadConversationReview.rejected, (state, action) => {
        state.review = {
          status: ADS.Error,
          error: action.error.message || "Failed to load the conversation",
          value: null,
        }
      })
  },
})

export type { State as ConversationReviewState }
export const conversationReviewInitialState = initialState
export const conversationReviewActions = { ...slice.actions }
export const conversationReviewSlice = slice
