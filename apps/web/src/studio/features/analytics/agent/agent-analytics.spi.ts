import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "../project/analytics.models"

export type AgentAnalyticsParams = {
  organizationId: string
  projectId: string
  agentId: string
  startAt: number
  endAt: number
}

export interface IAgentAnalyticsSpi {
  getConversationsPerDay(params: AgentAnalyticsParams): Promise<AnalyticsDailyPoint[]>
  getAvgUserQuestionsPerSessionPerDay(params: AgentAnalyticsParams): Promise<AnalyticsDailyPoint[]>
  getConversationsByCategoryPerDay(
    params: AgentAnalyticsParams,
  ): Promise<AnalyticsCategoryDailyPoint[]>
  getEmptySessionsPerDay(params: AgentAnalyticsParams): Promise<AnalyticsDailyPoint[]>
}
