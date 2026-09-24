import { AnalyticsRoutes as Routes } from "@caseai-connect/api-contracts"
import { Controller, Get, ParseIntPipe, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { toAnalyticsDailyPointDto } from "@/domains/analytics/shared/analytics-dto.helpers"
import type { AnalyticsDailyPoint } from "@/domains/analytics/shared/analytics-metrics.types"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { ProjectsAnalyticsGuard } from "./projects-analytics.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsAnalyticsService } from "./projects-analytics.service"
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsAnalyticsGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectsAnalyticsController {
  constructor(private readonly projectsAnalyticsService: ProjectsAnalyticsService) {}

  @Get(Routes.getConversationsPerDay.path)
  @CheckPolicy((policy) => policy.canList())
  async getConversationsPerDay(
    @Req() request: EndpointRequestWithProject,
    @Query("startAt", ParseIntPipe) startAt: number,
    @Query("endAt", ParseIntPipe) endAt: number,
    @Query("agentId", new ParseUUIDPipe({ optional: true })) agentId?: string,
  ): Promise<typeof Routes.getConversationsPerDay.response> {
    const conversationsPerDay: AnalyticsDailyPoint[] =
      await this.projectsAnalyticsService.getConversationsPerDay({
        connectScope: getRequiredConnectScope(request),
        agentId,
        startAt,
        endAt,
      })

    return { data: toAnalyticsDailyPointDto(conversationsPerDay) }
  }

  @Get(Routes.getAvgUserQuestionsPerSessionPerDay.path)
  @CheckPolicy((policy) => policy.canList())
  async getAvgUserQuestionsPerSessionPerDay(
    @Req() request: EndpointRequestWithProject,
    @Query("startAt", ParseIntPipe) startAt: number,
    @Query("endAt", ParseIntPipe) endAt: number,
    @Query("agentId", new ParseUUIDPipe({ optional: true })) agentId?: string,
  ): Promise<typeof Routes.getAvgUserQuestionsPerSessionPerDay.response> {
    const avgUserQuestionsPerSessionPerDay: AnalyticsDailyPoint[] =
      await this.projectsAnalyticsService.getAvgUserQuestionsPerSessionPerDay({
        connectScope: getRequiredConnectScope(request),
        agentId,
        startAt,
        endAt,
      })

    return { data: toAnalyticsDailyPointDto(avgUserQuestionsPerSessionPerDay) }
  }
}
