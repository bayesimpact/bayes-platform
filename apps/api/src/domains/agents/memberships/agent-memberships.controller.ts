import {
  type AgentMembershipDto,
  AgentMembershipRoutes,
  buildNameFromEmail,
} from "@caseai-connect/api-contracts"
import { Controller, Delete, Get, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentMembership,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_MEMBER_DELETE_PERMISSION,
  AGENT_MEMBER_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { AgentMembershipModel } from "./agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./agent-memberships.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentMembershipsController {
  constructor(private readonly agentMembershipsService: AgentMembershipsService) {}

  @Get(AgentMembershipRoutes.getAll.path)
  @CheckPermission(AGENT_MEMBER_READ_PERMISSION, "agent")
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentMembershipRoutes.getAll.response> {
    const { agent } = request
    const memberships = await this.agentMembershipsService.listAgentMemberships(agent.id)

    return { data: memberships.map(toDto) }
  }

  @Delete(AgentMembershipRoutes.deleteOne.path)
  @CheckPermission(AGENT_MEMBER_DELETE_PERMISSION, "agent")
  @AddContext("agentMembership")
  @TrackActivity({ action: "agentMembership.delete", entityFrom: "memberAgentMembership" })
  async removeAgentMembership(
    @Req() request: EndpointRequestWithAgentMembership,
  ): Promise<typeof AgentMembershipRoutes.deleteOne.response> {
    const { agent, memberAgentMembership } = request

    await this.agentMembershipsService.removeAgentMembership({
      userId: request.user.id,
      membershipId: memberAgentMembership.id,
      agentId: agent.id,
    })

    return { data: { success: true } }
  }
}

function toDto(membership: AgentMembershipModel): AgentMembershipDto {
  return {
    id: membership.id,
    agentId: membership.agentId,
    userId: membership.userId,
    userName: membership.user.name ?? buildNameFromEmail(membership.user.email),
    userEmail: membership.user.email,
    userHasSignedIn: membership.user.authSubject !== null,
    role: membership.role,
    createdAt: membership.createdAt.getTime(),
  }
}
