import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest, JwtPayload } from "@/common/context/request.interface"
import { getAccessToken } from "@/common/utils/get-access-token"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "./invitations.service"

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * Only JwtAuthGuard (no UserGuard) so this runs before /me and reconciles placeholder auth0Id.
   */
  @UseGuards(JwtAuthGuard)
  @Post(InvitationsRoutes.acceptOne.path)
  @TrackActivity({ action: "invitation.accept" })
  async acceptInvitation(
    @Req() request: { user: JwtPayload },
    @Body() body: typeof InvitationsRoutes.acceptOne.request,
  ): Promise<typeof InvitationsRoutes.acceptOne.response> {
    const jwtPayload = request.user
    // @ts-expect-error Nest request typing
    const accessToken = getAccessToken(request.headers.authorization)

    const { userId } = await this.invitationsService.acceptInvitation({
      ticketId: body.payload.ticketId,
      auth0Sub: jwtPayload.sub,
      accessToken,
    })

    ;(request as Record<string, unknown>).activityUserId = userId

    return { data: { success: true } }
  }

  @UseGuards(JwtAuthGuard, UserGuard)
  @Get(InvitationsRoutes.listPendingMine.path)
  async listPendingMine(
    @Req() request: EndpointRequest,
  ): Promise<typeof InvitationsRoutes.listPendingMine.response> {
    const invitations = await this.invitationsService.listPendingMine({
      userId: request.user.id,
      userEmail: request.user.email,
    })
    return { data: { invitations } }
  }

  @UseGuards(JwtAuthGuard, UserGuard)
  @Get(InvitationsRoutes.listForTarget.path)
  async listForTarget(
    @Req() request: EndpointRequest,
    @Query("targetType") targetType: string | undefined,
    @Query("targetId") targetId: string | undefined,
  ): Promise<typeof InvitationsRoutes.listForTarget.response> {
    if (!targetType || !targetId) {
      throw new BadRequestException("targetType and targetId query parameters are required")
    }
    const invitations = await this.invitationsService.listForTarget({
      userId: request.user.id,
      targetType,
      targetId,
    })
    return { data: { invitations } }
  }
}
