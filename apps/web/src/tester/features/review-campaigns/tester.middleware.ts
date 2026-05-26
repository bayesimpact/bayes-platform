import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { agentSessionMessagesActions } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { listMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.thunks"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { reviewCampaignsTesterActions } from "./tester.slice"
import {
  getMyTesterSurvey,
  getTesterContext,
  listMyReviewCampaigns,
  listMyTesterSessions,
  startTesterSession,
  submitTesterFeedback,
  submitTesterSurvey,
  updateTesterFeedback,
  updateTesterSurvey,
} from "./tester.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsTesterActions.campaignsMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listMyReviewCampaigns())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsTesterActions.campaignMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const organizationId = getCurrentId({ state, name: "organizationId" })
      const projectId = getCurrentId({ state, name: "projectId" })
      const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
      const scope = { organizationId, projectId, reviewCampaignId }
      listenerApi.dispatch(getTesterContext(scope))
      listenerApi.dispatch(listMyTesterSessions(scope))
      listenerApi.dispatch(getMyTesterSurvey())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsTesterActions.sessionMount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentSessionId = getCurrentId({ state, name: "agentSessionId" })

      listenerApi.dispatch(agentSessionMessagesActions.reset())
      listenerApi.dispatch(listMessages(agentSessionId))
    },
  })

  // ---------------------------------------------------------------------------
  // Notification listeners (existing behavior).
  // ---------------------------------------------------------------------------
  listenerMiddleware.startListening({
    actionCreator: startTesterSession.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Session started", type: "success" }))

      action.meta.arg.onSuccess?.(action.payload.sessionId)
    },
  })
  listenerMiddleware.startListening({
    matcher: isAnyOf(submitTesterFeedback.fulfilled, updateTesterFeedback.fulfilled),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Feedback saved", type: "success" }))
    },
  })
  listenerMiddleware.startListening({
    matcher: isAnyOf(submitTesterSurvey.fulfilled, updateTesterSurvey.fulfilled),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Survey saved", type: "success" }))
    },
  })
  // FIXME:
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      startTesterSession.rejected,
      submitTesterFeedback.rejected,
      updateTesterFeedback.rejected,
      submitTesterSurvey.rejected,
      updateTesterSurvey.rejected,
    ),
    effect: async (action, listenerApi) => {
      const errorAction = action as { error?: { message?: string } }
      listenerApi.dispatch(
        notificationsActions.show({
          title: errorAction.error?.message || "Something went wrong",
          type: "error",
        }),
      )
    },
  })
}

export const reviewCampaignsTesterMiddleware = { listenerMiddleware, registerListeners }
