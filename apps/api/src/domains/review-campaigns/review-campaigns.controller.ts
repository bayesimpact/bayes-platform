import { addMemberRoleSchema, ReviewCampaignsRoutes } from "@bayes-platform/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaign } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignsService } from "./review-campaigns.service"

/**
 * The two campaign routes of the Studio's member page: give a role, take one back. Evaluation
 * serves every other campaign route under `eval/`.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "reviewCampaign")
@Controller()
export class ReviewCampaignsController {
  constructor(private readonly reviewCampaignsService: ReviewCampaignsService) {}

  @Post(ReviewCampaignsRoutes.addMemberRole.path)
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
