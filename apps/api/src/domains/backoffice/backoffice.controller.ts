import { BackofficeRoutes, type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  toBackofficeOrganizationDto,
  toBackofficeProjectSessionCategoryDto,
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
    const { organizations, total } = await this.backofficeService.listOrganizationsWithProjects({
      canListAll,
      userId: user.id,
      page,
      limit,
      search,
    })
    return {
      data: {
        organizations: organizations.map((organization) =>
          toBackofficeOrganizationDto({ ...organization, projects: organization.projects ?? [] }),
        ),
        total,
        page,
        limit,
      },
    }
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
    const { users, total } = await this.backofficeService.listUsersWithMemberships({
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

  @Patch(BackofficeRoutes.replaceProjectSessionCategories.path)
  @TrackActivity({ action: "replace_project_session_categories", entityFrom: "project" })
  async replaceProjectSessionCategories(
    @Req() request: EndpointRequest,
    @Param("projectId") projectId: string,
    @Body() body: typeof BackofficeRoutes.replaceProjectSessionCategories.request,
  ): Promise<typeof BackofficeRoutes.replaceProjectSessionCategories.response> {
    const { user } = request
    const canListAll = isEmailBackofficeAuthorized(user.email)
    const categories = await this.backofficeService.replaceProjectSessionCategories({
      projectId,
      categoryNames: body.payload.categoryNames,
      canListAll,
      userId: user.id,
    })
    return { data: categories.map(toBackofficeProjectSessionCategoryDto) }
  }
}
