import { createListenerMiddleware } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createAgentMessageFeedback,
  listAgentMessageFeedbacks,
} from "./agent-message-feedback.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh feedbacks when agents are loaded
  listenerMiddleware.startListening({
    actionCreator: listAgents.fulfilled,
    effect: async (action, listenerApi) => {
      const agents = action.payload
      await Promise.all(
        agents.map(async (agent) => {
          if (agent.type === "extraction") return
          await listenerApi.dispatch(listAgentMessageFeedbacks({ agentId: agent.id }))
        }),
      )
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

      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(listAgentMessageFeedbacks({ agentId }))
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
