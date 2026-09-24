import type { AnalyticsDailyPoint } from "./analytics.models"

export type ProjectAnalyticsParams = {
  organizationId: string
  projectId: string
  startAt: number
  endAt: number
  agentId?: string
}

export interface IProjectAnalyticsSpi {
  getConversationsPerDay(params: ProjectAnalyticsParams): Promise<AnalyticsDailyPoint[]>
  getAvgUserQuestionsPerSessionPerDay(
    params: ProjectAnalyticsParams,
  ): Promise<AnalyticsDailyPoint[]>
}
