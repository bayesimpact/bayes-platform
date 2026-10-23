import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  ConversationReview,
  ConversationReviewTab,
  PaginatedConversationReviewSessions,
} from "./conversation-review.models"
import {
  loadConversationReview,
  loadConversationReviewSessions,
} from "./conversation-review.thunks"

interface State {
  review: AsyncData<ConversationReview>
  /** The open tab of the screen. */
  reviewTab: ConversationReviewTab
  /** One page of the session list, or none loaded yet. */
  sessions: AsyncData<PaginatedConversationReviewSessions>
  /** The listed category: an id, or null for the sessions no category tagged. */
  sessionsCategoryId: string | null | undefined
  /** The session row the reviewer picked from the list. */
  selectedSessionId: string | null
}

const initialState: State = {
  review: defaultAsyncData,
  reviewTab: "session-id",
  sessions: defaultAsyncData,
  sessionsCategoryId: undefined,
  selectedSessionId: null,
}

const slice = createSlice({
  name: "conversationReview",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
    setReviewTab: (state, { payload }: { payload: ConversationReviewTab }) => {
      state.reviewTab = payload
    },
    selectSessionCategory: (state, { payload }: { payload: string | null }) => {
      state.sessionsCategoryId = payload
      state.sessions = defaultAsyncData
      state.selectedSessionId = null
    },
    selectSession: (state, { payload }: { payload: string }) => {
      state.selectedSessionId = payload
    },
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
      .addCase(loadConversationReviewSessions.pending, (state) => {
        state.sessions = { status: ADS.Loading, error: null, value: null }
      })
      .addCase(loadConversationReviewSessions.fulfilled, (state, action) => {
        state.sessions = { status: ADS.Fulfilled, error: null, value: action.payload }
      })
      .addCase(loadConversationReviewSessions.rejected, (state, action) => {
        state.sessions = {
          status: ADS.Error,
          error: action.error.message || "Failed to load the session list",
          value: null,
        }
      })
  },
})

export type { State as ConversationReviewState }
export const conversationReviewInitialState = initialState
export const conversationReviewActions = { ...slice.actions }
export const conversationReviewSlice = slice
