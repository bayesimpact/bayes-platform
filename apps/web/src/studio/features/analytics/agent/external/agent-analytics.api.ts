import {
  AgentAnalyticsRoutes,
  type AnalyticsCategoryDailyPointDto,
  type AnalyticsDailyPointDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "../../project/analytics.models"
import type { IAgentAnalyticsSpi } from "../agent-analytics.spi"

export default {
  getConversationsPerDay: async ({ organizationId, projectId, agentId, startAt, endAt }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentAnalyticsRoutes.getConversationsPerDay.response>(
      AgentAnalyticsRoutes.getConversationsPerDay.getPath({
        organizationId,
        projectId,
        agentId,
      }),
      dateRangeQueryParams(startAt, endAt),
    )
    return toAnalyticsDailyPoints(response.data.data)
  },
  getAvgUserQuestionsPerSessionPerDay: async ({
    organizationId,
    projectId,
    agentId,
    startAt,
    endAt,
  }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentAnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay.response
    >(
      AgentAnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay.getPath({
        organizationId,
        projectId,
        agentId,
      }),
      dateRangeQueryParams(startAt, endAt),
    )
    return toAnalyticsDailyPoints(response.data.data)
  },
  getConversationsByCategoryPerDay: async ({
    organizationId,
    projectId,
    agentId,
    startAt,
    endAt,
  }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentAnalyticsRoutes.getConversationsByCategoryPerDay.response
    >(
      AgentAnalyticsRoutes.getConversationsByCategoryPerDay.getPath({
        organizationId,
        projectId,
        agentId,
      }),
      dateRangeQueryParams(startAt, endAt),
    )
    return toAnalyticsCategoryDailyPoints(response.data.data)
  },
  getEmptySessionsPerDay: async ({ organizationId, projectId, agentId, startAt, endAt }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentAnalyticsRoutes.getEmptySessionsPerDay.response>(
      AgentAnalyticsRoutes.getEmptySessionsPerDay.getPath({
        organizationId,
        projectId,
        agentId,
      }),
      dateRangeQueryParams(startAt, endAt),
    )
    return toAnalyticsDailyPoints(response.data.data)
  },
} satisfies IAgentAnalyticsSpi

function dateRangeQueryParams(startAt: number, endAt: number) {
  return { params: { startAt, endAt } }
}

function toAnalyticsDailyPoints(dtos: AnalyticsDailyPointDto[]): AnalyticsDailyPoint[] {
  return dtos.map((dto) => ({
    date: dto.date,
    value: dto.value,
  }))
}

function toAnalyticsCategoryDailyPoints(
  dtos: AnalyticsCategoryDailyPointDto[],
): AnalyticsCategoryDailyPoint[] {
  return dtos.map((dto) => ({
    date: dto.date,
    agentId: dto.agentId,
    agentName: dto.agentName,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    value: dto.value,
    isUncategorized: dto.isUncategorized,
  }))
}
