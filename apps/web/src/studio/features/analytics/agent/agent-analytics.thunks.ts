import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { hasFeatureOrThrow } from "@/common/hooks/use-feature-flags"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "../project/analytics.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const loadAgentAnalytics = createAsyncThunk<
  {
    conversationsPerDay: AnalyticsDailyPoint[]
    avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[]
    conversationsByCategoryPerDay: AnalyticsCategoryDailyPoint[]
  },
  { startAt: number; endAt: number },
  ThunkConfig
>("agentAnalytics/load", async ({ startAt, endAt }, { extra: { services }, getState }) => {
  const state = getState()
  hasFeatureOrThrow({ state, feature: "project-analytics" })
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })
  const [conversationsPerDay, avgUserQuestionsPerSessionPerDay, conversationsByCategoryPerDay] =
    await Promise.all([
      services.agentAnalytics.getConversationsPerDay({
        organizationId,
        projectId,
        agentId,
        startAt,
        endAt,
      }),
      services.agentAnalytics.getAvgUserQuestionsPerSessionPerDay({
        organizationId,
        projectId,
        agentId,
        startAt,
        endAt,
      }),
      services.agentAnalytics.getConversationsByCategoryPerDay({
        organizationId,
        projectId,
        agentId,
        startAt,
        endAt,
      }),
    ])
  return { conversationsPerDay, avgUserQuestionsPerSessionPerDay, conversationsByCategoryPerDay }
})
