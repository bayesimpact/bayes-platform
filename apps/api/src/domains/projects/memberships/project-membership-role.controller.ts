import { addProjectMemberRolesSchema, ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards, UsePipes } from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithProjectMembership,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
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

  @Post(ProjectMembershipRoutes.addRoles.path)
  @CheckPermission(PROJECT_MEMBER_UPDATE_PERMISSION, "project")
  @UsePipes(new ZodValidationPipe(addProjectMemberRolesSchema))
  @TrackActivity({ action: "projectMembership.addRoles" })
  async addRoles(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof ProjectMembershipRoutes.addRoles.request,
  ): Promise<typeof ProjectMembershipRoutes.addRoles.response> {
    const { memberships, rolesById } = await this.projectMembershipsService.addRolesToMembers({
      callerUserId: request.user.id,
      memberUserIds: payload.userIds,
      projectId: request.project.id,
      roleKeys: payload.roleKeys,
    })

    return {
      data: memberships.map((membership) => toProjectMembershipDto(membership, rolesById)),
    }
  }

  @Delete(ProjectMembershipRoutes.removeRole.path)
  @AddContext("projectMembership")
  @CheckPermission(PROJECT_MEMBER_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "projectMembership.removeRole", entityFrom: "memberProjectMembership" })
  async removeRole(
    @Req() request: EndpointRequestWithProjectMembership,
    @Param("roleKey") roleKey: string,
  ): Promise<typeof ProjectMembershipRoutes.removeRole.response> {
    const { membership, rolesById } = await this.projectMembershipsService.removeRoleFromMember({
      callerUserId: request.user.id,
      memberUserId: request.memberProjectMembership.userId,
      projectId: request.project.id,
      roleKey,
    })

    return { data: toProjectMembershipDto(membership, rolesById) }
  }
}
