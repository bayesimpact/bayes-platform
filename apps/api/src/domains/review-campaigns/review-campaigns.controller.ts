import {
  type CampaignAggregatesDto,
  type ReviewCampaignDetailDto,
  type ReviewCampaignDto,
  type ReviewCampaignMembershipDto,
  ReviewCampaignsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithReviewCampaign,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewCampaignMembershipModel } from "./memberships/review-campaign-membership.model"
import type { ReviewCampaign } from "./review-campaign.entity"
import { ReviewCampaignsGuard } from "./review-campaigns.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignsService } from "./review-campaigns.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ReviewCampaignsGuard)
@RequireContext("organization", "project")
@Controller()
export class ReviewCampaignsController {
  constructor(private readonly reviewCampaignsService: ReviewCampaignsService) {}

  @Post(ReviewCampaignsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof ReviewCampaignsRoutes.createOne.request,
  ): Promise<typeof ReviewCampaignsRoutes.createOne.response> {
    const campaign = await this.reviewCampaignsService.createCampaign({
      connectScope: getRequiredConnectScope(request),
      fields: payload,
    })
    return { data: toReviewCampaignDto(campaign) }
  }

  @Get(ReviewCampaignsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ReviewCampaignsRoutes.getAll.response> {
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

  @Get(ReviewCampaignsRoutes.getOne.path)
  @AddContext("reviewCampaign")
  @CheckPolicy((policy) => policy.canView())
  async getOne(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<typeof ReviewCampaignsRoutes.getOne.response> {
    const { campaign, memberships, aggregates } = await this.reviewCampaignsService.getDetail({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
    })
    return { data: toReviewCampaignDetailDto(campaign, memberships, aggregates) }
  }

  @Patch(ReviewCampaignsRoutes.updateOne.path)
  @AddContext("reviewCampaign")
  @CheckPolicy((policy) => policy.canUpdate())
  async updateOne(
    @Req() request: EndpointRequestWithReviewCampaign,
    @Body() { payload }: typeof ReviewCampaignsRoutes.updateOne.request,
  ): Promise<typeof ReviewCampaignsRoutes.updateOne.response> {
    const campaign = await this.reviewCampaignsService.updateCampaign({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
      fieldsToUpdate: payload,
    })
    return { data: toReviewCampaignDto(campaign) }
  }

  @Delete(ReviewCampaignsRoutes.deleteOne.path)
  @AddContext("reviewCampaign")
  @CheckPolicy((policy) => policy.canDelete())
  async deleteOne(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<typeof ReviewCampaignsRoutes.deleteOne.response> {
    await this.reviewCampaignsService.deleteCampaign({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
    })
    return { data: { success: true } }
  }

  @Delete(ReviewCampaignsRoutes.revokeMembership.path)
  @AddContext("reviewCampaign")
  @CheckPolicy((policy) => policy.canUpdate())
  async revokeMembership(
    @Req() request: EndpointRequestWithReviewCampaign,
    @Param("membershipId") membershipId: string,
  ): Promise<typeof ReviewCampaignsRoutes.revokeMembership.response> {
    await this.reviewCampaignsService.revokeMembership({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
      membershipId,
    })
    return { data: { success: true } }
  }
}

function toReviewCampaignDto(campaign: ReviewCampaign): ReviewCampaignDto {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
    agentId: campaign.agentId,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    testerPerSessionQuestions: campaign.testerPerSessionQuestions,
    testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
    reviewerQuestions: campaign.reviewerQuestions,
    activatedAt: campaign.activatedAt ? campaign.activatedAt.getTime() : null,
    closedAt: campaign.closedAt ? campaign.closedAt.getTime() : null,
    createdAt: campaign.createdAt.getTime(),
    updatedAt: campaign.updatedAt.getTime(),
  }
}

function toReviewCampaignMembershipDto(
  membership: ReviewCampaignMembershipModel,
): ReviewCampaignMembershipDto {
  return {
    id: membership.id,
    campaignId: membership.campaignId,
    userId: membership.userId,
    userEmail: membership.user?.email ?? "",
    role: membership.role,
  }
}

function toReviewCampaignDetailDto(
  campaign: ReviewCampaign,
  memberships: ReviewCampaignMembershipModel[],
  aggregates: CampaignAggregatesDto | null,
): ReviewCampaignDetailDto {
  return {
    ...toReviewCampaignDto(campaign),
    memberships: memberships.map(toReviewCampaignMembershipDto),
    aggregates,
  }
}
