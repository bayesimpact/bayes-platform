import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type {
  ConversationReview,
  PaginatedConversationReviewSessions,
} from "./conversation-review.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

/** Rows of the safety review session list per page. */
export const REVIEW_SESSIONS_PAGE_SIZE = 20

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

export const loadConversationReviewSessions = createAsyncThunk<
  PaginatedConversationReviewSessions,
  { categoryId: string | null; page: number },
  ThunkConfig
>(
  "conversationReview/loadSessions",
  async ({ categoryId, page }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.conversationReview.listSessionsByCategory({
      organizationId,
      projectId,
      agentId,
      categoryId,
      page,
      limit: REVIEW_SESSIONS_PAGE_SIZE,
    })
  },
)
