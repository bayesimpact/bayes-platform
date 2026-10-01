import { AgentInvitationsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AGENT_MEMBER_INVITE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { agentInvitationTarget } from "./invitation-targets"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "./invitations.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(AgentInvitationsRoutes.getAll.path)
  @CheckPermission(AGENT_MEMBER_INVITE_PERMISSION, "agent")
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentInvitationsRoutes.getAll.response> {
    const invitations = await this.invitationsService.listForTarget(
      agentInvitationTarget(request.agent),
    )
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Post(AgentInvitationsRoutes.createMany.path)
  @CheckPermission(AGENT_MEMBER_INVITE_PERMISSION, "agent")
  @TrackActivity({ action: "invitation.invite" })
  async createMany(
    @Req() request: EndpointRequestWithAgent,
    @Body() body: typeof AgentInvitationsRoutes.createMany.request,
  ): Promise<typeof AgentInvitationsRoutes.createMany.response> {
    const invitations = await this.invitationsService.createMany({
      target: agentInvitationTarget(request.agent),
      emails: body.payload.emails ?? [],
    })
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Delete(AgentInvitationsRoutes.deleteOne.path)
  @CheckPermission(AGENT_MEMBER_INVITE_PERMISSION, "agent")
  @TrackActivity({ action: "invitation.revoke" })
  async deleteOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof AgentInvitationsRoutes.deleteOne.response> {
    await this.invitationsService.revokeOne({
      invitationId,
      target: agentInvitationTarget(request.agent),
    })
    return { data: { success: true } }
  }
}
