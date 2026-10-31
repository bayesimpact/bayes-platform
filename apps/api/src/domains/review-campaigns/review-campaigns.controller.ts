import {
  addMemberRoleSchema,
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
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { toMembershipRoleDto } from "@/domains/memberships/membership-roles"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewCampaignMembershipModel } from "./memberships/review-campaign-membership.model"
import type { ReviewCampaign } from "./review-campaign.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignsService } from "./review-campaigns.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ReviewCampaignsController {
  constructor(private readonly reviewCampaignsService: ReviewCampaignsService) {}

  @Post(ReviewCampaignsRoutes.createOne.path)
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION, "project")
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
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION, "project")
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
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION, "project")
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
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION, "project")
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
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION, "project")
  async deleteOne(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<typeof ReviewCampaignsRoutes.deleteOne.response> {
    await this.reviewCampaignsService.deleteCampaign({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
    })
    return { data: { success: true } }
  }

  @Post(ReviewCampaignsRoutes.addMemberRole.path)
  @AddContext("reviewCampaign")
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION, "project")
  @TrackActivity({ action: "reviewCampaignMembership.addRole" })
  async addMemberRole(
    @Req() request: EndpointRequestWithReviewCampaign,
    @Param("userId") memberUserId: string,
    @Body(new ZodValidationPipe(addMemberRoleSchema))
    { payload }: typeof ReviewCampaignsRoutes.addMemberRole.request,
  ): Promise<typeof ReviewCampaignsRoutes.addMemberRole.response> {
    await this.reviewCampaignsService.addMemberRole({
      connectScope: getRequiredConnectScope(request),
      reviewCampaignId: request.reviewCampaign.id,
      callerUserId: request.user.id,
      memberUserId,
      roleKey: payload.roleKey,
    })
    return { data: { success: true } }
  }

  @Delete(ReviewCampaignsRoutes.revokeMembership.path)
  @AddContext("reviewCampaign")
  @CheckPermission(PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION, "project")
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

/** One entry per person, with every role they hold on the campaign, each with its row id. */
function toReviewCampaignMembershipDtos(
  memberships: ReviewCampaignMembershipModel[],
): ReviewCampaignMembershipDto[] {
  const membershipsByUserId = new Map<string, ReviewCampaignMembershipModel[]>()
  for (const membership of memberships) {
    const roleGrants = membershipsByUserId.get(membership.userId)
    if (roleGrants) roleGrants.push(membership)
    else membershipsByUserId.set(membership.userId, [membership])
  }

  return [...membershipsByUserId.values()].flatMap((roleGrants) => {
    const [first] = roleGrants
    if (!first) return []
    return [
      {
        campaignId: first.campaignId,
        userId: first.userId,
        userEmail: first.user?.email ?? "",
        userHasSignedIn: first.user ? first.user.authSubject !== null : false,
        roles: roleGrants.map((membership) => toMembershipRoleDto(membership.membershipRole)),
      },
    ]
  })
}

function toReviewCampaignDetailDto(
  campaign: ReviewCampaign,
  memberships: ReviewCampaignMembershipModel[],
  aggregates: CampaignAggregatesDto | null,
): ReviewCampaignDetailDto {
  return {
    ...toReviewCampaignDto(campaign),
    memberships: toReviewCampaignMembershipDtos(memberships),
    aggregates,
  }
}
