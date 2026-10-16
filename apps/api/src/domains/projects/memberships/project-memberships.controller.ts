import { type ProjectMemberAgentDto, ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import { Controller, Delete, Get, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithProjectMembership,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_MEMBER_DELETE_PERMISSION,
  PROJECT_MEMBER_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toProjectMembershipDto } from "./project-membership.mapper"
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
      data: memberships.map((membership) =>
        toProjectMembershipDto(
          membership,
          membership.roleId ? roleGrantsByRoleId.get(membership.roleId) : undefined,
        ),
      ),
    }
  }

  @Get(ProjectMembershipRoutes.getMemberAgents.path)
  @AddContext("projectMembership")
  @CheckPermission(PROJECT_MEMBER_READ_PERMISSION, "project")
  async getMemberAgents(
    @Req() request: EndpointRequestWithProjectMembership,
  ): Promise<typeof ProjectMembershipRoutes.getMemberAgents.response> {
    const { project, memberProjectMembership } = request

    const entries = await this.projectMembershipsService.listMemberAgents({
      projectId: project.id,
      userId: memberProjectMembership.userId,
    })

    const data: ProjectMemberAgentDto[] = entries.map(({ agent, membership, permissions }) => ({
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      membershipId: membership?.id ?? null,
      role: membership?.role ?? null,
      permissions,
    }))

    return { data }
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
      membershipId: memberProjectMembership.id,
      projectId: project.id,
      userId: request.user.id,
    })

    return { data: { success: true } }
  }
}
