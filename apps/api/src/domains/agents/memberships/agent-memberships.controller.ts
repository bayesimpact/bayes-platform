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
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { AgentMembership } from "./agent-membership.entity"
import { AgentMembershipsGuard } from "./agent-memberships.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./agent-memberships.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, AgentMembershipsGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentMembershipsController {
  constructor(private readonly agentMembershipsService: AgentMembershipsService) {}

  @Get(AgentMembershipRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentMembershipRoutes.getAll.response> {
    const { agent } = request
    const memberships = await this.agentMembershipsService.listAgentMemberships(agent.id)

    return { data: memberships.map(toDto) }
  }

  @Delete(AgentMembershipRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
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

function toDto(entity: AgentMembership): AgentMembershipDto {
  return {
    id: entity.id,
    agentId: entity.agentId,
    userId: entity.userId,
    userName: entity.user.name ?? buildNameFromEmail(entity.user.email),
    userEmail: entity.user.email,
    role: entity.role,
    status: entity.status,
    createdAt: entity.createdAt.getTime(),
  }
}
