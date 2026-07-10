import {
  type ProjectMemberAgentDto,
  type ProjectMembershipDto,
  ProjectMembershipRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Delete, Get, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithProject,
  EndpointRequestWithProjectMembership,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { ProjectMembershipModel } from "./project-membership.model"
import { ProjectMembershipsGuard } from "./project-memberships.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./project-memberships.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectMembershipsGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectMembershipsController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) {}

  @Get(ProjectMembershipRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectMembershipRoutes.getAll.response> {
    const { project } = request

    const memberships = await this.projectMembershipsService.listProjectMemberships(project.id)

    return { data: memberships.map(toDto) }
  }

  @Get(ProjectMembershipRoutes.getMemberAgents.path)
  @AddContext("projectMembership")
  @CheckPolicy((policy) => policy.canList())
  async getMemberAgents(
    @Req() request: EndpointRequestWithProjectMembership,
  ): Promise<typeof ProjectMembershipRoutes.getMemberAgents.response> {
    const { project, memberProjectMembership } = request

    const entries = await this.projectMembershipsService.listMemberAgents({
      projectId: project.id,
      userId: memberProjectMembership.userId,
    })

    const data: ProjectMemberAgentDto[] = entries.map(({ agent, membership }) => ({
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      membershipId: membership?.id ?? null,
      role: membership?.role ?? null,
    }))

    return { data }
  }

  // TODO: edit role

  @Delete(ProjectMembershipRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
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

function toDto(model: ProjectMembershipModel): ProjectMembershipDto {
  return {
    id: model.id,
    projectId: model.projectId,
    userId: model.userId,
    userName: model.user.name,
    userEmail: model.user.email,
    createdAt: model.createdAt.getTime(),
    role: model.role,
  }
}
