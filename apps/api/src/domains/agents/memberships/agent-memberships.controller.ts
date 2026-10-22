import {
  type AgentMembershipDto,
  AgentMembershipRoutes,
  addAgentMemberRolesSchema,
  addMemberRoleSchema,
  buildNameFromEmail,
  deleteAgentMembersSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentMembership,
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
  AGENT_MEMBER_DELETE_PERMISSION,
  AGENT_MEMBER_READ_PERMISSION,
  AGENT_MEMBER_UPDATE_PERMISSION,
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
      callerUserId: request.user.id,
      memberUserId: memberAgentMembership.userId,
      agentId: agent.id,
    })

    return { data: { success: true } }
  }

  @Post(AgentMembershipRoutes.deleteMany.path)
  @HttpCode(200)
  @CheckPermission(AGENT_MEMBER_DELETE_PERMISSION, "agent")
  @TrackActivity({ action: "agentMembership.deleteMany" })
  async removeAgentMemberships(
    @Req() request: EndpointRequestWithAgent,
    @Body(new ZodValidationPipe(deleteAgentMembersSchema))
    { payload }: typeof AgentMembershipRoutes.deleteMany.request,
  ): Promise<typeof AgentMembershipRoutes.deleteMany.response> {
    await this.agentMembershipsService.removeAgentMemberships({
      callerUserId: request.user.id,
      memberUserIds: payload.userIds,
      agentId: request.agent.id,
    })
    return { data: { success: true } }
  }

  @Post(AgentMembershipRoutes.addRoles.path)
  @CheckPermission(AGENT_MEMBER_UPDATE_PERMISSION, "agent")
  @TrackActivity({ action: "agentMembership.addRoles" })
  async addRoles(
    @Req() request: EndpointRequestWithAgent,
    @Body(new ZodValidationPipe(addAgentMemberRolesSchema))
    { payload }: typeof AgentMembershipRoutes.addRoles.request,
  ): Promise<typeof AgentMembershipRoutes.addRoles.response> {
    await this.agentMembershipsService.addRolesToMembers({
      callerUserId: request.user.id,
      memberUserIds: payload.userIds,
      agentId: request.agent.id,
      projectId: request.project.id,
      roleKeys: payload.roleKeys,
    })
    return { data: { success: true } }
  }

  @Post(AgentMembershipRoutes.addRole.path)
  @CheckPermission(AGENT_MEMBER_UPDATE_PERMISSION, "agent")
  @TrackActivity({ action: "agentMembership.addRole" })
  async addRole(
    @Req() request: EndpointRequestWithAgent,
    @Param("userId") memberUserId: string,
    @Body(new ZodValidationPipe(addMemberRoleSchema))
    { payload }: typeof AgentMembershipRoutes.addRole.request,
  ): Promise<typeof AgentMembershipRoutes.addRole.response> {
    await this.agentMembershipsService.addMemberRole({
      callerUserId: request.user.id,
      memberUserId,
      agentId: request.agent.id,
      projectId: request.project.id,
      roleKey: payload.roleKey,
    })
    return { data: { success: true } }
  }

  @Delete(AgentMembershipRoutes.removeRole.path)
  @CheckPermission(AGENT_MEMBER_UPDATE_PERMISSION, "agent")
  @TrackActivity({ action: "agentMembership.removeRole" })
  async removeRole(
    @Req() request: EndpointRequestWithAgent,
    @Param("userId") memberUserId: string,
    @Param("roleKey") roleKey: string,
  ): Promise<typeof AgentMembershipRoutes.removeRole.response> {
    await this.agentMembershipsService.removeMemberRole({
      callerUserId: request.user.id,
      memberUserId,
      agentId: request.agent.id,
      roleKey,
    })
    return { data: { success: true } }
  }
}

function toDto(membership: AgentMembershipModel): AgentMembershipDto {
  return {
    agentId: membership.agentId,
    userId: membership.userId,
    userName: membership.user.name ?? buildNameFromEmail(membership.user.email),
    userEmail: membership.user.email,
    userHasSignedIn: membership.user.authSubject !== null,
    roles: membership.roles.map(toMembershipRoleDto),
    createdAt: membership.createdAt.getTime(),
  }
}
