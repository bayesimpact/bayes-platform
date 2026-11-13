import type { AgentMessageFeedbackRating } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentMessageFeedback } from "./agent-message-feedback.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgentMessageFeedbacks = createAsyncThunk<
  AgentMessageFeedback[],
  { agentId: string },
  ThunkConfig
>("agentMessageFeedback/list", async (params, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.agentMessageFeedback.getAll({ ...params, organizationId, projectId })
})

export const createAgentMessageFeedback = createAsyncThunk<
  void,
  { agentMessageId: string; rating: AgentMessageFeedbackRating; content?: string },
  ThunkConfig
>(
  "agentMessageFeedback/create",
  async ({ agentMessageId, rating, content }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.agentMessageFeedback.createOne({
      organizationId,
      projectId,
      agentMessageId,
      rating,
      content,
    })
  },
)
