import type { RootState } from "@/common/store"
import type { AsyncData } from "@/common/store/async-data-status"
import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "../project/analytics.models"

export const selectAgentAnalyticsConversationsPerDay = (
  state: RootState,
): AsyncData<AnalyticsDailyPoint[]> => state.agentAnalytics.conversationsPerDay

export const selectAgentAnalyticsAvgUserQuestionsPerSessionPerDay = (
  state: RootState,
): AsyncData<AnalyticsDailyPoint[]> => state.agentAnalytics.avgUserQuestionsPerSessionPerDay

export const selectAgentAnalyticsConversationsByCategoryPerDay = (
  state: RootState,
): AsyncData<AnalyticsCategoryDailyPoint[]> => state.agentAnalytics.conversationsByCategoryPerDay
