import { AgentAnalyticsRoutes as Routes } from "@caseai-connect/api-contracts"
import { Controller, Get, ParseIntPipe, Query, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import {
  toAnalyticsCategoryDailyPointDto,
  toAnalyticsDailyPointDto,
} from "@/domains/analytics/shared/analytics-dto.helpers"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "@/domains/analytics/shared/analytics-metrics.types"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AGENT_ANALYTICS_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsAnalyticsService } from "./agents-analytics.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentsAnalyticsController {
  constructor(private readonly agentsAnalyticsService: AgentsAnalyticsService) {}

  @Get(Routes.getConversationsPerDay.path)
  @CheckPermission(AGENT_ANALYTICS_READ_PERMISSION, "agent")
  async getConversationsPerDay(
    @Req() request: EndpointRequestWithAgent,
    @Query("startAt", ParseIntPipe) startAt: number,
    @Query("endAt", ParseIntPipe) endAt: number,
  ): Promise<typeof Routes.getConversationsPerDay.response> {
    const conversationsPerDay: AnalyticsDailyPoint[] =
      await this.agentsAnalyticsService.getConversationsPerDay({
        connectScope: getRequiredConnectScope(request),
        agentId: request.agent.id,
        startAt,
        endAt,
      })

    return { data: toAnalyticsDailyPointDto(conversationsPerDay) }
  }

  @Get(Routes.getAvgUserQuestionsPerSessionPerDay.path)
  @CheckPermission(AGENT_ANALYTICS_READ_PERMISSION, "agent")
  async getAvgUserQuestionsPerSessionPerDay(
    @Req() request: EndpointRequestWithAgent,
    @Query("startAt", ParseIntPipe) startAt: number,
    @Query("endAt", ParseIntPipe) endAt: number,
  ): Promise<typeof Routes.getAvgUserQuestionsPerSessionPerDay.response> {
    const avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[] =
      await this.agentsAnalyticsService.getAvgUserQuestionsPerSessionPerDay({
        connectScope: getRequiredConnectScope(request),
        agentId: request.agent.id,
        startAt,
        endAt,
      })

    return { data: toAnalyticsDailyPointDto(avgUserQuestionsPerSessionPerDay) }
  }

  @Get(Routes.getConversationsByCategoryPerDay.path)
  @CheckPermission(AGENT_ANALYTICS_READ_PERMISSION, "agent")
  async getConversationsByCategoryPerDay(
    @Req() request: EndpointRequestWithAgent,
    @Query("startAt", ParseIntPipe) startAt: number,
    @Query("endAt", ParseIntPipe) endAt: number,
  ): Promise<typeof Routes.getConversationsByCategoryPerDay.response> {
    const conversationsByCategoryPerDay: AnalyticsCategoryDailyPoint[] =
      await this.agentsAnalyticsService.getConversationsByCategoryPerDay({
        connectScope: getRequiredConnectScope(request),
        agentId: request.agent.id,
        startAt,
        endAt,
      })

    return { data: toAnalyticsCategoryDailyPointDto(conversationsByCategoryPerDay) }
  }
}
