import type { RootState } from "@/common/store"
import type { AsyncData } from "@/common/store/async-data-status"
import type { AnalyticsDailyPoint } from "./analytics.models"

export const selectAnalyticsConversationsPerDay = (
  state: RootState,
): AsyncData<AnalyticsDailyPoint[]> => state.projectAnalytics.conversationsPerDay

export const selectAnalyticsAvgUserQuestionsPerSessionPerDay = (
  state: RootState,
): AsyncData<AnalyticsDailyPoint[]> => state.projectAnalytics.avgUserQuestionsPerSessionPerDay
