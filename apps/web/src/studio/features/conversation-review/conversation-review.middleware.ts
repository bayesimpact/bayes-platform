import { createListenerMiddleware } from "@reduxjs/toolkit"
import { hasAgentChanged } from "@/common/features/agents/agents.selectors"
import { hasProjectChanged } from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import { conversationReviewActions } from "./conversation-review.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  registerUnmountListener()
  // A conversation opened for review never outlives the agent it belongs to.
  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return (
        hasProjectChanged(originalState, currentState) ||
        hasAgentChanged(originalState, currentState)
      )
    },
    effect: (_, listenerApi) => {
      listenerApi.dispatch(conversationReviewActions.reset())
    },
  })
}

// Leaving the page forgets the conversation: a review is read where it is opened, never kept.
function registerUnmountListener() {
  listenerMiddleware.startListening({
    actionCreator: conversationReviewActions.unmount,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(conversationReviewActions.reset())
    },
  })
}

export const conversationReviewMiddleware = { listenerMiddleware, registerListeners }
