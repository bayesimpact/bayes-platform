import {
  BackofficeRoutes,
  createBackofficeOrganizationSchema,
  type FeatureFlagKey,
  FeatureFlags,
  grantBackofficeAgentConversationReviewerSchema,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  BACKOFFICE_AGENT_READ_PERMISSION,
  BACKOFFICE_CONVERSATION_REVIEWER_UPDATE_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
  ORGANIZATION_CREATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { TrackActivity } from "../activities/track-activity.decorator"
import { BackofficeGuard } from "./backoffice.guard"
import {
  toBackofficeAgentDetailDto,
  toBackofficeAgentListItemDto,
  toBackofficeOrganizationDetailDto,
  toBackofficeOrganizationDto,
  toBackofficeProjectDetailDto,
  toBackofficeProjectListItemDto,
  toBackofficeUserDetailDto,
  toBackofficeUserDto,
} from "./backoffice.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BackofficeService } from "./backoffice.service"

const VALID_FEATURE_FLAG_KEYS = new Set<string>(FeatureFlags.map((flag) => flag.key))

function assertValidFeatureFlagKey(value: string): FeatureFlagKey {
  if (!VALID_FEATURE_FLAG_KEYS.has(value)) {
    throw new BadRequestException(`Unknown feature flag key: ${value}`)
  }
  return value as FeatureFlagKey
}

@UseGuards(JwtAuthGuard, UserGuard, BackofficeGuard, CheckPermissionGuard)
@Controller()
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get(BackofficeRoutes.listOrganizations.path)
  async listOrganizations(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listOrganizations.response> {
    const { user } = request
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { organizations, total } = await this.backofficeService.listOrganizations({
      userId: user.id,
      page,
      limit,
      search,
    })
    return {
      data: {
        organizations: organizations.map(toBackofficeOrganizationDto),
        total,
        page,
        limit,
      },
    }
  }

  @Get(BackofficeRoutes.getOrganization.path)
  @CheckPermission(BACKOFFICE_ORGANIZATION_READ_PERMISSION, "organization")
  async getOrganization(
    @Param("organizationId") organizationId: string,
  ): Promise<typeof BackofficeRoutes.getOrganization.response> {
    const result = await this.backofficeService.getOrganizationDetail({
      targetOrganizationId: organizationId,
    })
    if (!result) throw new NotFoundException(`Organization ${organizationId} not found`)
    return {
      data: toBackofficeOrganizationDetailDto(result.organization, result.members, result.projects),
    }
  }

  @Get(BackofficeRoutes.listAgents.path)
  async listAgents(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listAgents.response> {
    const { user } = request
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { agents, total } = await this.backofficeService.listAgents({
      userId: user.id,
      page,
      limit,
      search,
    })
    return {
      data: {
        agents: agents.map(toBackofficeAgentListItemDto),
        total,
        page,
        limit,
      },
    }
  }

  @Get(BackofficeRoutes.getAgent.path)
  @CheckPermission(BACKOFFICE_AGENT_READ_PERMISSION, "agent")
  async getAgent(
    @Param("agentId") agentId: string,
  ): Promise<typeof BackofficeRoutes.getAgent.response> {
    const result = await this.backofficeService.getAgentDetail({
      targetAgentId: agentId,
    })
    if (!result) throw new NotFoundException(`Agent ${agentId} not found`)
    return {
      data: toBackofficeAgentDetailDto(result.agent, result.members, result.conversationReviewers),
    }
  }

  @Post(BackofficeRoutes.grantAgentConversationReviewer.path)
  @CheckPermission(BACKOFFICE_CONVERSATION_REVIEWER_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.agent.conversation_reviewer.grant", entityFrom: "agent" })
  async grantAgentConversationReviewer(
    @Req() request: EndpointRequest,
    @Param("agentId", new ParseUUIDPipe()) agentId: string,
    @Body(new ZodValidationPipe(grantBackofficeAgentConversationReviewerSchema))
    body: typeof BackofficeRoutes.grantAgentConversationReviewer.request,
  ): Promise<typeof BackofficeRoutes.grantAgentConversationReviewer.response> {
    await this.backofficeService.grantAgentConversationReviewer({
      agentId,
      email: body.payload.email,
    })
    attachTrackedActivity(request, { entityFrom: "agent", entityId: agentId })
    return { data: { success: true } }
  }

  @Delete(BackofficeRoutes.revokeAgentConversationReviewer.path)
  @CheckPermission(BACKOFFICE_CONVERSATION_REVIEWER_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.agent.conversation_reviewer.revoke", entityFrom: "agent" })
  async revokeAgentConversationReviewer(
    @Req() request: EndpointRequest,
    @Param("agentId", new ParseUUIDPipe()) agentId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
  ): Promise<typeof BackofficeRoutes.revokeAgentConversationReviewer.response> {
    await this.backofficeService.revokeAgentConversationReviewer({ agentId, userId })
    attachTrackedActivity(request, { entityFrom: "agent", entityId: agentId })
    return { data: { success: true } }
  }

  @Get(BackofficeRoutes.listUsers.path)
  async listUsers(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listUsers.response> {
    const { user } = request
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { users, total } = await this.backofficeService.listUsers({
      userId: user.id,
      page,
      limit,
      search,
    })
    return {
      data: {
        users: users.map(toBackofficeUserDto),
        total,
        page,
        limit,
      },
    }
  }

  @Get(BackofficeRoutes.getUser.path)
  async getUser(
    @Req() request: EndpointRequest,
    @Param("userId") userId: string,
  ): Promise<typeof BackofficeRoutes.getUser.response> {
    const { user } = request
    const result = await this.backofficeService.getUserDetail({
      requestingUserId: user.id,
      targetUserId: userId,
    })
    if (!result) throw new NotFoundException(`User ${userId} not found`)
    return {
      data: toBackofficeUserDetailDto(
        result.user,
        result.globalRoles,
        result.organizationMemberships,
        result.projectMemberships,
        result.agentMemberships,
        result.reviewCampaignMemberships,
        result.roleGrantsByRoleId,
      ),
    }
  }

  @Get(BackofficeRoutes.getRbacCatalog.path)
  async getRbacCatalog(): Promise<typeof BackofficeRoutes.getRbacCatalog.response> {
    const catalog = await this.backofficeService.getRbacCatalog()
    return { data: catalog }
  }

  @Get(BackofficeRoutes.listProjects.path)
  async listProjects(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listProjects.response> {
    const { user } = request
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { projects, total } = await this.backofficeService.listProjects({
      userId: user.id,
      page,
      limit,
      search,
    })
    return {
      data: {
        projects: projects.map(toBackofficeProjectListItemDto),
        total,
        page,
        limit,
      },
    }
  }

  @Get(BackofficeRoutes.getProject.path)
  @CheckPermission(BACKOFFICE_PROJECT_READ_PERMISSION, "project")
  async getProject(
    @Param("projectId") projectId: string,
  ): Promise<typeof BackofficeRoutes.getProject.response> {
    const result = await this.backofficeService.getProjectDetail({
      targetProjectId: projectId,
    })
    if (!result) throw new NotFoundException(`Project ${projectId} not found`)
    return {
      data: toBackofficeProjectDetailDto(result.project, result.members, result.agents),
    }
  }

  @Post(BackofficeRoutes.createOrganization.path)
  @CheckPermission(ORGANIZATION_CREATE_PERMISSION)
  @TrackActivity({ action: "backoffice.organization.create" })
  @UsePipes(new ZodValidationPipe(createBackofficeOrganizationSchema))
  async createOrganization(
    @Req() request: EndpointRequest,
    @Body() body: typeof BackofficeRoutes.createOrganization.request,
  ): Promise<typeof BackofficeRoutes.createOrganization.response> {
    const organization = await this.backofficeService.createOrganization({
      actingUserId: request.user.id,
      name: body.payload.name,
    })
    return { data: toBackofficeOrganizationDto(organization) }
  }

  @Post(BackofficeRoutes.addFeatureFlag.path)
  @CheckPermission(BACKOFFICE_PROJECT_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "add_feature_flag", entityFrom: "project" })
  async addFeatureFlag(
    @Param("projectId") projectId: string,
    @Body() body: typeof BackofficeRoutes.addFeatureFlag.request,
  ): Promise<typeof BackofficeRoutes.addFeatureFlag.response> {
    const featureFlagKey = assertValidFeatureFlagKey(body.payload.featureFlagKey)
    await this.backofficeService.addFeatureFlag({
      projectId,
      featureFlagKey,
    })
    return { data: { success: true } }
  }

  @Delete(BackofficeRoutes.removeFeatureFlag.path)
  @CheckPermission(BACKOFFICE_PROJECT_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "add_feature_flag", entityFrom: "project" })
  async removeFeatureFlag(
    @Param("projectId") projectId: string,
    @Param("featureFlagKey") featureFlagKey: string,
  ): Promise<typeof BackofficeRoutes.removeFeatureFlag.response> {
    const validatedKey = assertValidFeatureFlagKey(featureFlagKey)
    await this.backofficeService.removeFeatureFlag({
      projectId,
      featureFlagKey: validatedKey,
    })
    return { data: { success: true } }
  }
}
