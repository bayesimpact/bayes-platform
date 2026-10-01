import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithInvitationScope,
} from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { InvitationsGuard } from "./invitations.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService, type InvitationTarget } from "./invitations.service"

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, InvitationsGuard)
  @RequireContext("invitationScope")
  @CheckPolicy((policy) => policy.canCreate())
  @Post(InvitationsRoutes.createMany.path)
  @TrackActivity({ action: "invitation.invite" })
  async createMany(
    @Req() request: EndpointRequestWithInvitationScope,
    @Body() body: typeof InvitationsRoutes.createMany.request,
  ): Promise<typeof InvitationsRoutes.createMany.response> {
    const invitations = await this.invitationsService.createMany({
      target: toInvitationTarget(body.payload.targetType, request),
      emails: body.payload.emails ?? [],
      role: body.payload.role,
    })
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, InvitationsGuard)
  @RequireContext("invitationScope")
  @CheckPolicy((policy) => policy.canList())
  @Get(InvitationsRoutes.listForTarget.path)
  async listForTarget(
    @Req() request: EndpointRequestWithInvitationScope & { query: { targetType: string } },
  ): Promise<typeof InvitationsRoutes.listForTarget.response> {
    const target = toInvitationTarget(request.query.targetType, request)
    const invitations = await this.invitationsService.listForTarget(target)
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, InvitationsGuard)
  @RequireContext("invitationScope")
  @CheckPolicy((policy) => policy.canDelete())
  @Delete(InvitationsRoutes.revokeOne.path)
  @TrackActivity({ action: "invitation.revoke" })
  async revokeOne(
    @Req() request: EndpointRequestWithInvitationScope,
  ): Promise<typeof InvitationsRoutes.revokeOne.response> {
    if (!request.invitation) throw new NotFoundException()
    await this.invitationsService.revokeOne(request.invitation)
    return { data: { success: true } }
  }

  @UseGuards(JwtAuthGuard, UserGuard)
  @Get(InvitationsRoutes.listPendingMine.path)
  async listPendingMine(
    @Req() request: EndpointRequest,
  ): Promise<typeof InvitationsRoutes.listPendingMine.response> {
    const invitations = await this.invitationsService.listPendingMine(request.user.id)
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @UseGuards(JwtAuthGuard, UserGuard)
  @Post(InvitationsRoutes.acceptOne.path)
  @TrackActivity({ action: "invitation.accept" })
  async acceptOne(
    @Req() request: EndpointRequest,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof InvitationsRoutes.acceptOne.response> {
    await this.invitationsService.acceptOne({ invitationId, userId: request.user.id })
    return { data: { success: true } }
  }

  @UseGuards(JwtAuthGuard, UserGuard)
  @Post(InvitationsRoutes.declineOne.path)
  @TrackActivity({ action: "invitation.decline" })
  async declineOne(
    @Req() request: EndpointRequest,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof InvitationsRoutes.declineOne.response> {
    await this.invitationsService.declineOne({ invitationId, userId: request.user.id })
    return { data: { success: true } }
  }
}

/** The scope resolver already loaded the target entity matching `targetType`. */
function toInvitationTarget(
  targetType: string,
  request: EndpointRequestWithInvitationScope,
): InvitationTarget {
  const target = request.invitationTarget
  if (!target) throw new NotFoundException()
  switch (targetType) {
    case "project":
      return {
        targetType,
        targetId: target.id,
        organizationId: target.organizationId,
        projectId: target.id,
      }
    case "agent":
    case "review_campaign":
      return {
        targetType,
        targetId: target.id,
        organizationId: target.organizationId,
        projectId: (target as { projectId: string }).projectId,
        status: "status" in target ? String(target.status) : undefined,
      }
    default:
      throw new NotFoundException()
  }
}
