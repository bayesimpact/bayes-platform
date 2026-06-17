import { BackofficeRoutes, type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { TrackActivity } from "../activities/track-activity.decorator"
import { isEmailBackofficeAuthorized } from "./backoffice.authorization"
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

@UseGuards(JwtAuthGuard, UserGuard, BackofficeGuard)
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
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { organizations, total } = await this.backofficeService.listOrganizations({
      canListAll,
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
  async getOrganization(
    @Req() request: EndpointRequest,
    @Param("organizationId") organizationId: string,
  ): Promise<typeof BackofficeRoutes.getOrganization.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const result = await this.backofficeService.getOrganizationDetail({
      canListAll,
      requestingUserId: user.id,
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
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { agents, total } = await this.backofficeService.listAgents({
      canListAll,
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
  async getAgent(
    @Req() request: EndpointRequest,
    @Param("agentId") agentId: string,
  ): Promise<typeof BackofficeRoutes.getAgent.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const result = await this.backofficeService.getAgentDetail({
      canListAll,
      requestingUserId: user.id,
      targetAgentId: agentId,
    })
    if (!result) throw new NotFoundException(`Agent ${agentId} not found`)
    return { data: toBackofficeAgentDetailDto(result.agent, result.members) }
  }

  @Get(BackofficeRoutes.listUsers.path)
  async listUsers(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listUsers.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { users, total } = await this.backofficeService.listUsers({
      canListAll,
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
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const result = await this.backofficeService.getUserDetail({
      canListAll,
      requestingUserId: user.id,
      targetUserId: userId,
    })
    if (!result) throw new NotFoundException(`User ${userId} not found`)
    return {
      data: toBackofficeUserDetailDto(
        result.user,
        result.organizationMemberships,
        result.projectMemberships,
        result.agentMemberships,
      ),
    }
  }

  @Get(BackofficeRoutes.listProjects.path)
  async listProjects(
    @Req() request: EndpointRequest,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("search") search?: string,
  ): Promise<typeof BackofficeRoutes.listProjects.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const { projects, total } = await this.backofficeService.listProjects({
      canListAll,
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
  async getProject(
    @Req() request: EndpointRequest,
    @Param("projectId") projectId: string,
  ): Promise<typeof BackofficeRoutes.getProject.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const result = await this.backofficeService.getProjectDetail({
      canListAll,
      requestingUserId: user.id,
      targetProjectId: projectId,
    })
    if (!result) throw new NotFoundException(`Project ${projectId} not found`)
    return {
      data: toBackofficeProjectDetailDto(result.project, result.members, result.agents),
    }
  }

  @Post(BackofficeRoutes.addFeatureFlag.path)
  @TrackActivity({ action: "add_feature_flag", entityFrom: "project" })
  async addFeatureFlag(
    @Req() request: EndpointRequest,
    @Param("projectId") projectId: string,
    @Body() body: typeof BackofficeRoutes.addFeatureFlag.request,
  ): Promise<typeof BackofficeRoutes.addFeatureFlag.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const featureFlagKey = assertValidFeatureFlagKey(body.payload.featureFlagKey)
    await this.backofficeService.addFeatureFlag({
      projectId,
      featureFlagKey,
      canListAll,
      userId: user.id,
    })
    return { data: { success: true } }
  }

  @Delete(BackofficeRoutes.removeFeatureFlag.path)
  @TrackActivity({ action: "add_feature_flag", entityFrom: "project" })
  async removeFeatureFlag(
    @Req() request: EndpointRequest,
    @Param("projectId") projectId: string,
    @Param("featureFlagKey") featureFlagKey: string,
  ): Promise<typeof BackofficeRoutes.removeFeatureFlag.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const validatedKey = assertValidFeatureFlagKey(featureFlagKey)
    await this.backofficeService.removeFeatureFlag({
      projectId,
      featureFlagKey: validatedKey,
      canListAll,
      userId: user.id,
    })
    return { data: { success: true } }
  }
}
