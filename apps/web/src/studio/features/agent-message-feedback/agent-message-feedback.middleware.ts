import { createListenerMiddleware } from "@reduxjs/toolkit"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import { agentMessageFeedbackActions } from "./agent-message-feedback.slice"
import {
  createAgentMessageFeedback,
  listAgentMessageFeedbacks,
} from "./agent-message-feedback.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh feedbacks when agents are loaded
  listenerMiddleware.startListening({
    actionCreator: agentMessageFeedbackActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agent = selectCurrentAgentData(state)
      if (!ADS.isFulfilled(agent)) return

      if (agent.value.type === "extraction") return
      await listenerApi.dispatch(listAgentMessageFeedbacks({ agentId: agent.value.id }))
    },
  })

  // Refresh feedbacks when a new feedback is created
  listenerMiddleware.startListening({
    actionCreator: createAgentMessageFeedback.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Feedback submitted successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createAgentMessageFeedback.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to submit feedback",
          type: "error",
        }),
      )
    },
  })
}

export const agentMessageFeedbackMiddleware = { listenerMiddleware, registerListeners }
