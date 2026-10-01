import { ReviewCampaignInvitationsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaign } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { PROJECT_MEMBER_INVITE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { reviewCampaignInvitationTarget } from "./invitation-targets"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "./invitations.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "reviewCampaign")
@Controller()
export class ReviewCampaignInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(ReviewCampaignInvitationsRoutes.getAll.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<typeof ReviewCampaignInvitationsRoutes.getAll.response> {
    const invitations = await this.invitationsService.listForTarget(
      reviewCampaignInvitationTarget(request.reviewCampaign),
    )
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Post(ReviewCampaignInvitationsRoutes.createMany.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  @TrackActivity({ action: "invitation.invite" })
  async createMany(
    @Req() request: EndpointRequestWithReviewCampaign,
    @Body() body: typeof ReviewCampaignInvitationsRoutes.createMany.request,
  ): Promise<typeof ReviewCampaignInvitationsRoutes.createMany.response> {
    const invitations = await this.invitationsService.createMany({
      target: reviewCampaignInvitationTarget(request.reviewCampaign),
      emails: body.payload.emails ?? [],
      role: body.payload.role,
    })
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Delete(ReviewCampaignInvitationsRoutes.deleteOne.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  @TrackActivity({ action: "invitation.revoke" })
  async deleteOne(
    @Req() request: EndpointRequestWithReviewCampaign,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof ReviewCampaignInvitationsRoutes.deleteOne.response> {
    await this.invitationsService.revokeOne({
      invitationId,
      target: reviewCampaignInvitationTarget(request.reviewCampaign),
    })
    return { data: { success: true } }
  }
}
