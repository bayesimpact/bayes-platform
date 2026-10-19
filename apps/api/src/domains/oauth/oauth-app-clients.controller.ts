import { AppsRoutes } from "@caseai-connect/api-contracts"
import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { Request } from "express"
import { getOAuthAuthorizationEndpoint, getOAuthServerUrls } from "@/config/public-urls"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { BACKOFFICE_APP_MANAGE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthClientsService } from "./oauth-clients.service"

/** The confidential OAuth client of each app, managed from the back-office (ADR 0029). */
@UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
@Controller()
export class OAuthAppClientsController {
  constructor(private readonly oauthClientsService: OAuthClientsService) {}

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Get(AppsRoutes.getOAuthClient.path)
  async getOAuthClient(
    @Req() request: Request,
    @Param("appManifestId") appManifestId: string,
  ): Promise<typeof AppsRoutes.getOAuthClient.response> {
    const { issuer, appsResource } = getOAuthServerUrls(request)
    return {
      data: {
        clientId: await this.oauthClientsService.getAppClientId(appManifestId),
        issuer,
        authorizationEndpoint: getOAuthAuthorizationEndpoint(request),
        resource: appsResource,
      },
    }
  }

  @CheckPermission(BACKOFFICE_APP_MANAGE_PERMISSION)
  @Post(AppsRoutes.createOAuthClientSecret.path)
  @TrackActivity({ action: "appManifest.update" })
  async createOAuthClientSecret(
    @Param("appManifestId") appManifestId: string,
  ): Promise<typeof AppsRoutes.createOAuthClientSecret.response> {
    return { data: await this.oauthClientsService.createAppClientSecret(appManifestId) }
  }
}
