import {
  deleteProjectMembersSchema,
  type MemberResourceRolesDto,
  ProjectMembershipRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithProjectMembership,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { toMembershipRoleDto } from "@/domains/memberships/membership-roles"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_MEMBER_DELETE_PERMISSION,
  PROJECT_MEMBER_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toProjectMembershipDto } from "./project-membership.mapper"
import type { MemberResourceRoles } from "./project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./project-memberships.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectMembershipsController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) {}

  @Get(ProjectMembershipRoutes.getAll.path)
  @CheckPermission(PROJECT_MEMBER_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectMembershipRoutes.getAll.response> {
    const { project } = request

    const { memberships, roleGrantsByRoleId } =
      await this.projectMembershipsService.listProjectMembershipsWithRoleGrants(project.id)

    return {
      data: memberships.map((membership) => toProjectMembershipDto(membership, roleGrantsByRoleId)),
    }
  }

  @Get(ProjectMembershipRoutes.getMemberRoles.path)
  @AddContext("projectMembership")
  @CheckPermission(PROJECT_MEMBER_READ_PERMISSION, "project")
  async getMemberRoles(
    @Req() request: EndpointRequestWithProjectMembership,
  ): Promise<typeof ProjectMembershipRoutes.getMemberRoles.response> {
    const { membership, roleGrantsByRoleId, workspace, agents, campaigns } =
      await this.projectMembershipsService.getMemberRoles({
        memberUserId: request.memberProjectMembership.userId,
        projectId: request.project.id,
      })

    const toResourceDto = (resource: MemberResourceRoles): MemberResourceRolesDto => ({
      ...resource,
      roles: resource.roles.map(toMembershipRoleDto),
    })
    return {
      data: {
        member: toProjectMembershipDto(membership, roleGrantsByRoleId),
        workspace: toResourceDto(workspace),
        agents: agents.map(toResourceDto),
        campaigns: campaigns.map(toResourceDto),
      },
    }
  }

  @Delete(ProjectMembershipRoutes.deleteOne.path)
  @CheckPermission(PROJECT_MEMBER_DELETE_PERMISSION, "project")
  @AddContext("projectMembership")
  @TrackActivity({ action: "projectMembership.delete", entityFrom: "memberProjectMembership" })
  async removeProjectMembership(
    @Req() request: EndpointRequestWithProjectMembership,
  ): Promise<typeof ProjectMembershipRoutes.deleteOne.response> {
    const { project, memberProjectMembership } = request

    await this.projectMembershipsService.removeProjectMembership({
      callerUserId: request.user.id,
      memberUserId: memberProjectMembership.userId,
      projectId: project.id,
    })

    return { data: { success: true } }
  }

  @Get(ProjectMembershipRoutes.getAssignableRoles.path)
  @CheckPermission(PROJECT_MEMBER_READ_PERMISSION, "project")
  async getAssignableRoles(): Promise<typeof ProjectMembershipRoutes.getAssignableRoles.response> {
    return { data: await this.projectMembershipsService.listAssignableRoles() }
  }

  @Post(ProjectMembershipRoutes.deleteMany.path)
  @HttpCode(200)
  @CheckPermission(PROJECT_MEMBER_DELETE_PERMISSION, "project")
  @UsePipes(new ZodValidationPipe(deleteProjectMembersSchema))
  @TrackActivity({ action: "projectMembership.deleteMany" })
  async removeProjectMemberships(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof ProjectMembershipRoutes.deleteMany.request,
  ): Promise<typeof ProjectMembershipRoutes.deleteMany.response> {
    await this.projectMembershipsService.removeProjectMemberships({
      callerUserId: request.user.id,
      memberUserIds: payload.userIds,
      projectId: request.project.id,
    })

    return { data: { success: true } }
  }
}
