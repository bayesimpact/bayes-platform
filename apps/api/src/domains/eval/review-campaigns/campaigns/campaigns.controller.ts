import { EvalReviewCampaignsRoutes } from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithReviewCampaign,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
import {
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  REVIEW_CAMPAIGN_READ_PERMISSION,
  REVIEW_CAMPAIGN_REPORT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReportsService } from "@/domains/review-campaigns/reports/reports.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignsService } from "@/domains/review-campaigns/review-campaigns.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TesterService } from "@/domains/review-campaigns/tester/tester.service"
import {
  toCampaignContextDto,
  toCampaignReportDto,
  toReviewCampaignDetailDto,
  toReviewCampaignDto,
} from "./campaign.mappers"

/**
 * The campaigns of a project: the routes for the people who manage them, the report and the
 * participants' context. `ReviewCampaignsController` of the `review-campaigns` domain serves the
 * Studio's member page: it gives a role without an invitation (`addMemberRole`) and has its own
 * `revokeMembership`, so a change to one revoke handler goes to the other.
 */
@Controller()
export class EvalReviewCampaignsController {
  constructor(
    private readonly reviewCampaignsService: ReviewCampaignsService,
    private readonly reportsService: ReportsService,
    private readonly testerService: TesterService,
  ) {}

  @SchemaRoute(EvalReviewCampaignsRoutes.getAllOfProject, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAllOfProject(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.getAllOfProject>> {
    const items = await this.reviewCampaignsService.listCampaigns(getRequiredConnectScope(request))
    return {
      data: {
        reviewCampaigns: items.map(({ campaign, memberCount }) => ({
          ...toReviewCampaignDto(campaign),
          memberCount,
        })),
      },
    }
  }

  @SchemaRoute(EvalReviewCampaignsRoutes.getOne, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async getOne(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.getOne>> {
    const detail = await this.reviewCampaignsService.getDetail({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
    })
    return { data: toReviewCampaignDetailDto(detail) }
  }

  /**
   * The schema refuses a blank name (422 before), a missing key of the configuration (defaulted
   * before) and an invalid question.
   */
  @SchemaRoute(EvalReviewCampaignsRoutes.createOne, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalReviewCampaignsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.createOne>> {
    const campaign = await this.reviewCampaignsService.createCampaign({
      connectScope: getRequiredConnectScope(request),
      fields: payload,
    })
    return { data: toReviewCampaignDto(campaign) }
  }

  /** The schema refuses an `agentId` (a retarget before), a blank name (422 before). */
  @SchemaRoute(EvalReviewCampaignsRoutes.updateOne, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async updateOne(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalReviewCampaignsRoutes.updateOne>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.updateOne>> {
    const campaign = await this.reviewCampaignsService.updateCampaign({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
      fieldsToUpdate: payload,
    })
    return { data: toReviewCampaignDto(campaign) }
  }

  @SchemaRoute(EvalReviewCampaignsRoutes.deleteOne, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async deleteOne(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.deleteOne>> {
    await this.reviewCampaignsService.deleteCampaign({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalReviewCampaignsRoutes.revokeMembership, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async revokeMembership(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { params }: SchemaRouteInput<typeof EvalReviewCampaignsRoutes.revokeMembership>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.revokeMembership>> {
    await this.reviewCampaignsService.revokeMembership({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
      membershipId: params.membershipId,
    })
    return { data: { success: true } }
  }

  // Reviewers hold the report key on their campaign, project owners and admins get it from the
  // project. Testers do not see the report.
  @SchemaRoute(EvalReviewCampaignsRoutes.getReport, {
    permission: { key: REVIEW_CAMPAIGN_REPORT_READ_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async getReport(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.getReport>> {
    const report = await this.reportsService.computeReport(request.reviewCampaign)
    return { data: toCampaignReportDto(report) }
  }

  // Testers and reviewers both hold review_campaign.read: the reviewer landing page reads it too.
  @SchemaRoute(EvalReviewCampaignsRoutes.getContext, {
    permission: { key: REVIEW_CAMPAIGN_READ_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async getContext(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewCampaignsRoutes.getContext>> {
    const context = await this.testerService.getTesterContext({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
    })
    return { data: toCampaignContextDto(request.reviewCampaign, context) }
  }
}
