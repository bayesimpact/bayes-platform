import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Patch, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProjectMembership } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { PROJECT_MEMBER_UPDATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toProjectMembershipDto } from "./project-membership.mapper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./project-memberships.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectMembershipRoleController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) {}

  @Patch(ProjectMembershipRoutes.updateOne.path)
  @AddContext("projectMembership")
  @CheckPermission(PROJECT_MEMBER_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "projectMembership.update", entityFrom: "memberProjectMembership" })
  async updateRole(
    @Req() request: EndpointRequestWithProjectMembership,
    @Body() { payload }: typeof ProjectMembershipRoutes.updateOne.request,
  ): Promise<typeof ProjectMembershipRoutes.updateOne.response> {
    const { project, memberProjectMembership } = request

    const { membership, roleGrant } =
      await this.projectMembershipsService.updateProjectMembershipRole({
        callerUserId: request.user.id,
        membershipId: memberProjectMembership.id,
        projectId: project.id,
        role: payload.role,
      })

    return { data: toProjectMembershipDto(membership, roleGrant) }
  }
}
