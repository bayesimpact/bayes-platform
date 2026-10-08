import {
  type AppInstallationSummaryDto,
  type AppInstallPageDto,
  AppsRoutes,
  authorizeAppInstallSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { APP_INSTALL_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ActiveAppInstallationSummary } from "./app-installation.repository"
import type { AppInstallPage } from "./apps.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
@Controller()
export class AppsInstallController {
  constructor(private readonly appsService: AppsService) {}

  @CheckPermission(APP_INSTALL_PERMISSION)
  @Get(AppsRoutes.getInstall.path)
  async getInstall(
    @Req() request: EndpointRequest,
    @Param("slug") slug: string,
  ): Promise<typeof AppsRoutes.getInstall.response> {
    const page = await this.appsService.getInstallPage({ slug, userId: request.user.id })
    return { data: toAppInstallPageDto(page) }
  }

  @CheckPermission(APP_INSTALL_PERMISSION)
  @Post(AppsRoutes.authorize.path)
  @TrackActivity({ action: "appInstallation.authorize", entityFrom: "appInstallation" })
  async authorize(
    @Req() request: EndpointRequest,
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(authorizeAppInstallSchema))
    body: typeof AppsRoutes.authorize.request,
  ): Promise<typeof AppsRoutes.authorize.response> {
    const result = await this.appsService.authorizeInstall({
      slug,
      userId: request.user.id,
      projectId: body.payload.projectId,
      permissions: body.payload.permissions,
      redirectUri: body.payload.redirectUri,
      state: body.payload.state,
    })
    attachTrackedActivity(request, {
      organizationId: result.organizationId,
      projectId: result.projectId,
      entityFrom: "appInstallation",
      entityId: result.installationId,
    })
    return {
      data: {
        clientId: result.clientId,
        clientSecret: result.clientSecret,
        redirectUri: result.redirectUri,
        state: result.state,
      },
    }
  }

  @CheckPermission(APP_INSTALL_PERMISSION)
  @Get(AppsRoutes.listForProject.path)
  async listForProject(
    @Param("projectId") projectId: string,
  ): Promise<typeof AppsRoutes.listForProject.response> {
    const installations = await this.appsService.listActiveInstallations(projectId)
    return { data: installations.map(toAppInstallationSummaryDto) }
  }

  @CheckPermission(APP_INSTALL_PERMISSION)
  @Post(AppsRoutes.revoke.path)
  @HttpCode(HttpStatus.OK)
  @TrackActivity({ action: "appInstallation.revoke", entityFrom: "appInstallation" })
  async revoke(
    @Req() request: EndpointRequest,
    @Param("id") installationId: string,
  ): Promise<typeof AppsRoutes.revoke.response> {
    const scope = await this.appsService.revokeInstallation({
      installationId,
      userId: request.user.id,
    })
    attachTrackedActivity(request, {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      entityFrom: "appInstallation",
      entityId: installationId,
    })
    return { data: { success: true } }
  }
}

function toAppInstallationSummaryDto(
  installation: ActiveAppInstallationSummary,
): AppInstallationSummaryDto {
  return {
    id: installation.id,
    appName: installation.appName,
    description: installation.description,
    logoUrl: installation.logoUrl,
    permissions: installation.permissions,
    clientId: installation.clientId,
    createdAt: installation.createdAt.getTime(),
  }
}

function toAppInstallPageDto(page: AppInstallPage): AppInstallPageDto {
  return {
    app: {
      id: page.app.id,
      name: page.app.name,
      slug: page.app.slug,
      description: page.app.description,
      logoUrl: page.app.logoUrl,
      grantablePermissions: page.app
        .grantablePermissions as AppInstallPageDto["app"]["grantablePermissions"],
      allowedRedirectUris: page.app.allowedRedirectUris,
    },
    projects: page.projects,
  }
}
