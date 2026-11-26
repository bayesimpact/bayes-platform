import { EvalCampaignInvitationsRoutes } from "@bayes-platform/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequestWithReviewCampaign } from "@/common/context/request.interface"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
import { reviewCampaignInvitationTarget } from "@/domains/invitations/invitation-targets"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "@/domains/invitations/invitations.service"
import { PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { toCampaignInvitationDto } from "./campaign.mappers"

/**
 * The pending invitations to a campaign. The Studio manages the invitations to a workspace and
 * to an agent with the controllers of the `invitations` domain.
 */
@Controller()
export class EvalCampaignInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @SchemaRoute(EvalCampaignInvitationsRoutes.getAll, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async getAll(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalCampaignInvitationsRoutes.getAll>> {
    const invitations = await this.invitationsService.listForTarget(
      reviewCampaignInvitationTarget(request.reviewCampaign),
    )
    const invitationDtos = await this.invitationsService.toDtos(invitations)
    return { data: { invitations: invitationDtos.map(toCampaignInvitationDto) } }
  }

  /**
   * The schema refuses an empty or missing list of emails, an address that is not an email, more
   * than 200 of them, and a missing language, which the old handler took.
   */
  @SchemaRoute(EvalCampaignInvitationsRoutes.createMany, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
    activity: { action: "invitation.invite" },
  })
  async createMany(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalCampaignInvitationsRoutes.createMany>,
  ): Promise<SchemaRouteResponse<typeof EvalCampaignInvitationsRoutes.createMany>> {
    const { invitations, emailSent } = await this.invitationsService.createMany({
      target: reviewCampaignInvitationTarget(request.reviewCampaign),
      emails: payload.emails,
      role: payload.role,
      inviter: { userId: request.user.id, name: request.user.name, email: request.user.email },
      language: payload.language,
    })
    const invitationDtos = await this.invitationsService.toDtos(invitations)
    return { data: { invitations: invitationDtos.map(toCampaignInvitationDto), emailSent } }
  }

  @SchemaRoute(EvalCampaignInvitationsRoutes.deleteOne, {
    permission: { key: PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION, on: "project" },
    context: ["organization", "project", "reviewCampaign"],
    activity: { action: "invitation.revoke" },
  })
  async deleteOne(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { params }: SchemaRouteInput<typeof EvalCampaignInvitationsRoutes.deleteOne>,
  ): Promise<SchemaRouteResponse<typeof EvalCampaignInvitationsRoutes.deleteOne>> {
    await this.invitationsService.revokeOne({
      invitationId: params.invitationId,
      target: reviewCampaignInvitationTarget(request.reviewCampaign),
    })
    return { data: { success: true } }
  }
}
