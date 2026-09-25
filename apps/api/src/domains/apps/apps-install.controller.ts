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
    return { data: result }
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
  async revoke(
    @Req() request: EndpointRequest,
    @Param("id") installationId: string,
  ): Promise<typeof AppsRoutes.revoke.response> {
    await this.appsService.revokeInstallation({
      installationId,
      userId: request.user.id,
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
    },
    projects: page.projects,
  }
}
