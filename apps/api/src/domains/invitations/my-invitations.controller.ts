import { MyInvitationsRoutes } from "@caseai-connect/api-contracts"
import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "./invitations.service"

/**
 * The signed-in person's own invitations. No permission check: the service
 * only finds invitations held by the caller's account.
 */
@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class MyInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(MyInvitationsRoutes.getAll.path)
  async getAll(
    @Req() request: EndpointRequest,
  ): Promise<typeof MyInvitationsRoutes.getAll.response> {
    const invitations = await this.invitationsService.listPendingMine(request.user.id)
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Post(MyInvitationsRoutes.acceptOne.path)
  @TrackActivity({ action: "invitation.accept" })
  async acceptOne(
    @Req() request: EndpointRequest,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof MyInvitationsRoutes.acceptOne.response> {
    await this.invitationsService.acceptOne({ invitationId, userId: request.user.id })
    return { data: { success: true } }
  }

  @Post(MyInvitationsRoutes.declineOne.path)
  @TrackActivity({ action: "invitation.decline" })
  async declineOne(
    @Req() request: EndpointRequest,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof MyInvitationsRoutes.declineOne.response> {
    await this.invitationsService.declineOne({ invitationId, userId: request.user.id })
    return { data: { success: true } }
  }
}
