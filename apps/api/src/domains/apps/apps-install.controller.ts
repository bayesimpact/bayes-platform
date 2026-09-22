import {
  type AppInstallPageDto,
  AppsRoutes,
  authorizeAppInstallSchema,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { APP_INSTALL_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
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
