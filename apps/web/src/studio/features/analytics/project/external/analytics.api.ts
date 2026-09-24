import { type AnalyticsDailyPointDto, AnalyticsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AnalyticsDailyPoint } from "../analytics.models"
import type { IProjectAnalyticsSpi } from "../analytics.spi"

export default {
  getConversationsPerDay: async ({ organizationId, projectId, startAt, endAt, agentId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AnalyticsRoutes.getConversationsPerDay.response>(
      AnalyticsRoutes.getConversationsPerDay.getPath({ organizationId, projectId }),
      dateRangeQueryParams(startAt, endAt, agentId),
    )
    return toAnalyticsDailyPoints(response.data.data)
  },
  getAvgUserQuestionsPerSessionPerDay: async ({
    organizationId,
    projectId,
    startAt,
    endAt,
    agentId,
  }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay.response
    >(
      AnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay.getPath({ organizationId, projectId }),
      dateRangeQueryParams(startAt, endAt, agentId),
    )
    return toAnalyticsDailyPoints(response.data.data)
  },
} satisfies IProjectAnalyticsSpi

function dateRangeQueryParams(startAt: number, endAt: number, agentId?: string) {
  return { params: { startAt, endAt, agentId } }
}

function toAnalyticsDailyPoints(dtos: AnalyticsDailyPointDto[]): AnalyticsDailyPoint[] {
  return dtos.map((dto) => ({
    date: dto.date,
    value: dto.value,
  }))
}
