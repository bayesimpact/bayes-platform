import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { getTesterContext } from "@/tester/features/review-campaigns/tester.thunks"
import { reviewCampaignsReviewerActions } from "./reviewer.slice"
import {
  getReviewerSession,
  listMyReviewerCampaigns,
  listReviewerSessions,
  submitReviewerReview,
  updateReviewerReview,
} from "./reviewer.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsReviewerActions.mount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listMyReviewerCampaigns())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsReviewerActions.campaignMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const organizationId = getCurrentId({ state, name: "organizationId" })
      const projectId = getCurrentId({ state, name: "projectId" })
      const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

      const scope = { organizationId, projectId, reviewCampaignId }
      listenerApi.dispatch(getTesterContext(scope))
      listenerApi.dispatch(listReviewerSessions(scope))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsReviewerActions.sessionMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const organizationId = getCurrentId({ state, name: "organizationId" })
      const projectId = getCurrentId({ state, name: "projectId" })
      const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
      const sessionId = getCurrentId({ state, name: "agentSessionId" })

      const scope = { organizationId, projectId, reviewCampaignId, sessionId }
      listenerApi.dispatch(getReviewerSession(scope))
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(submitReviewerReview.fulfilled, updateReviewerReview.fulfilled),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Review saved", type: "success" }))
    },
  })
  listenerMiddleware.startListening({
    matcher: isAnyOf(submitReviewerReview.rejected, updateReviewerReview.rejected),
    effect: async (action, listenerApi) => {
      const errorAction = action as { error?: { message?: string } }
      listenerApi.dispatch(
        notificationsActions.show({
          title: errorAction.error?.message || "Something went wrong",
          type: "error",
        }),
      )

      const state = listenerApi.getState()
      const organizationId = getCurrentId({ state, name: "organizationId" })
      const projectId = getCurrentId({ state, name: "projectId" })
      const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
      const sessionId = getCurrentId({ state, name: "agentSessionId" })

      const scope = { organizationId, projectId, reviewCampaignId, sessionId }
      listenerApi.dispatch(getTesterContext(scope))
      listenerApi.dispatch(listReviewerSessions(scope))
      listenerApi.dispatch(getReviewerSession(scope))
    },
  })
}

export const reviewCampaignsReviewerMiddleware = { listenerMiddleware, registerListeners }
