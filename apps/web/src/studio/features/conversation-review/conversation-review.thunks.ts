import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { ConversationReview } from "./conversation-review.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const loadConversationReview = createAsyncThunk<
  ConversationReview,
  { agentSessionId: string },
  ThunkConfig
>("conversationReview/load", async ({ agentSessionId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })
  return await services.conversationReview.getOne({
    organizationId,
    projectId,
    agentId,
    agentSessionId,
  })
})
