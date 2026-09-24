import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { hasFeatureOrThrow } from "@/common/hooks/use-feature-flags"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AnalyticsDailyPoint } from "./analytics.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const loadProjectAnalytics = createAsyncThunk<
  {
    conversationsPerDay: AnalyticsDailyPoint[]
    avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[]
  },
  { startAt: number; endAt: number; agentId?: string },
  ThunkConfig
>(
  "projectAnalytics/loadProject",
  async ({ startAt, endAt, agentId }, { extra: { services }, getState }) => {
    const state = getState()
    hasFeatureOrThrow({ state, feature: "project-analytics" })
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const [conversationsPerDay, avgUserQuestionsPerSessionPerDay] = await Promise.all([
      services.projectAnalytics.getConversationsPerDay({
        organizationId,
        projectId,
        startAt,
        endAt,
        agentId,
      }),
      services.projectAnalytics.getAvgUserQuestionsPerSessionPerDay({
        organizationId,
        projectId,
        startAt,
        endAt,
        agentId,
      }),
    ])
    return { conversationsPerDay, avgUserQuestionsPerSessionPerDay }
  },
)
