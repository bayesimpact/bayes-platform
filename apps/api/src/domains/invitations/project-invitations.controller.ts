import { ProjectInvitationsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { PROJECT_MEMBER_INVITE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { projectInvitationTarget } from "./invitation-targets"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationsService } from "./invitations.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(ProjectInvitationsRoutes.getAll.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectInvitationsRoutes.getAll.response> {
    const invitations = await this.invitationsService.listForTarget(
      projectInvitationTarget(request.project),
    )
    return { data: { invitations: await this.invitationsService.toDtos(invitations) } }
  }

  @Post(ProjectInvitationsRoutes.createMany.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  @TrackActivity({ action: "invitation.invite" })
  async createMany(
    @Req() request: EndpointRequestWithProject,
    @Body() body: typeof ProjectInvitationsRoutes.createMany.request,
  ): Promise<typeof ProjectInvitationsRoutes.createMany.response> {
    const { invitations, emailSent } = await this.invitationsService.createMany({
      target: projectInvitationTarget(request.project),
      emails: body.payload.emails ?? [],
      inviter: { name: request.user.name, email: request.user.email },
    })
    return {
      data: { invitations: await this.invitationsService.toDtos(invitations), emailSent },
    }
  }

  @Delete(ProjectInvitationsRoutes.deleteOne.path)
  @CheckPermission(PROJECT_MEMBER_INVITE_PERMISSION, "project")
  @TrackActivity({ action: "invitation.revoke" })
  async deleteOne(
    @Req() request: EndpointRequestWithProject,
    @Param("invitationId") invitationId: string,
  ): Promise<typeof ProjectInvitationsRoutes.deleteOne.response> {
    await this.invitationsService.revokeOne({
      invitationId,
      target: projectInvitationTarget(request.project),
    })
    return { data: { success: true } }
  }
}
