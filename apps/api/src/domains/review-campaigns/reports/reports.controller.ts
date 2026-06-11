import {
  type CampaignReportDto,
  type CampaignReportSessionRowDto,
  ReviewCampaignsRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaignMembership } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { CampaignReportGuard } from "./campaign-report.guard"
import type { CampaignReport, CampaignReportSessionRow } from "./reports.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReportsService } from "./reports.service"
import { buildSessionMatrixCsv } from "./reports-csv"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CampaignReportGuard)
@RequireContext("organization", "project", "reviewCampaign", "reviewCampaignMembership")
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(ReviewCampaignsRoutes.getCampaignReport.path)
  async getCampaignReport(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.getCampaignReport.response> {
    const report = await this.reportsService.computeReport(request.reviewCampaign)
    return { data: toCampaignReportDto(report) }
  }

  @Get(ReviewCampaignsRoutes.getCampaignReportCsv.path)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="campaign-report.csv"')
  async getCampaignReportCsv(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<string> {
    const report = await this.reportsService.computeReport(request.reviewCampaign)
    return buildSessionMatrixCsv(report)
  }
}

function toCampaignReportDto(report: CampaignReport): CampaignReportDto {
  return {
    campaignId: report.campaignId,
    headline: report.headline,
    testerPerSessionDistributions: report.testerPerSessionDistributions,
    testerEndOfPhaseDistributions: report.testerEndOfPhaseDistributions,
    reviewerDistributions: report.reviewerDistributions,
    sessionMatrix: report.sessionMatrix.map(toSessionRowDto),
  }
}

function toSessionRowDto(row: CampaignReportSessionRow): CampaignReportSessionRowDto {
  return {
    sessionId: row.sessionId,
    agentType: row.agentType,
    testerUserId: row.testerUserId,
    startedAt: row.startedAt.getTime(),
    testerRating: row.testerRating,
    reviewerRatings: row.reviewerRatings,
    reviewerCount: row.reviewerCount,
    meanReviewerRating: row.meanReviewerRating,
    reviewerRatingSpread: row.reviewerRatingSpread,
  }
}
