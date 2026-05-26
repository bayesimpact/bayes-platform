import { createSelector } from "@reduxjs/toolkit"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { AgentMessageFeedback } from "./agent-message-feedback.models"

export const selectAgentMessageFeedbackStatus = (state: RootState) =>
  state.agentMessageFeedback.data.status

export const selectAgentMessageFeedbackError = (state: RootState) =>
  state.agentMessageFeedback.data.error

export const selectAgentMessageFeedbackData = (state: RootState) => state.agentMessageFeedback.data

const missingAgentId = { status: ADS.Error, value: null, error: "No agent selected" }
const missingFeedbacks = { status: ADS.Error, value: null, error: "No feedbacks available" }

export const selectFeedbacksFromAgentId = (agentId?: string | null) =>
  createSelector(
    [selectAgentMessageFeedbackData],
    (feedbackData): AsyncData<AgentMessageFeedback[]> => {
      if (!agentId) return missingAgentId

      if (!ADS.isFulfilled(feedbackData)) return { ...feedbackData }

      if (!feedbackData.value?.[agentId]) return missingFeedbacks

      return { status: ADS.Fulfilled, value: feedbackData.value[agentId], error: null }
    },
  )

export const selectCurrentFeedbackId = (state: RootState) =>
  state.agentMessageFeedback.currentFeedbackId

export const selectCurrentAgentFeedbacksData = createSelector(
  [selectCurrentAgentId, selectAgentMessageFeedbackData],
  (agentId, feedbackData): AsyncData<AgentMessageFeedback[]> => {
    if (!agentId) return missingAgentId

    if (!ADS.isFulfilled(feedbackData)) return { ...feedbackData }

    if (!feedbackData.value?.[agentId]) return missingFeedbacks

    return { status: ADS.Fulfilled, value: feedbackData.value[agentId], error: null }
  },
)

export const selectFeedbackData = createSelector(
  [selectCurrentAgentFeedbacksData, selectCurrentFeedbackId],
  (feedbacksData, feedbackId): AsyncData<AgentMessageFeedback> => {
    if (!feedbackId) return { status: ADS.Error, value: null, error: "No feedback selected" }
    if (!ADS.isFulfilled(feedbacksData)) return { ...feedbacksData }
    const feedback = feedbacksData.value.find((f) => f.id === feedbackId)
    if (!feedback)
      return { status: ADS.Error, value: null, error: "Feedback not found for current agent" }
    return { status: ADS.Fulfilled, value: feedback, error: null }
  },
)
