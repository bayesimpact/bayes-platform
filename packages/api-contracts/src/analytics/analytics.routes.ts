import type { ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type { AnalyticsCategoryDailyPointDto, AnalyticsDailyPointDto } from "./analytics.dto"

/** Query: `startAt`, `endAt`, optional `agentId` — Unix ms (see `ProjectAnalyticsRequestDto`). */
export const AnalyticsRoutes = {
  getConversationsPerDay: defineRoute<ResponseData<AnalyticsDailyPointDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/analytics/conversations-per-day",
  }),

  getAvgUserQuestionsPerSessionPerDay: defineRoute<ResponseData<AnalyticsDailyPointDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/analytics/avg-user-questions-per-session-per-day",
  }),
}

/** Per-agent conversation metrics; query: `startAt`, `endAt` — Unix ms. */
export const AgentAnalyticsRoutes = {
  getConversationsPerDay: defineRoute<ResponseData<AnalyticsDailyPointDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/conversations-per-day",
  }),

  getAvgUserQuestionsPerSessionPerDay: defineRoute<ResponseData<AnalyticsDailyPointDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/avg-user-questions-per-session-per-day",
  }),

  getConversationsByCategoryPerDay: defineRoute<ResponseData<AnalyticsCategoryDailyPointDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/analytics/conversations-by-category-per-day",
  }),
}
