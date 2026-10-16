import { OAuthRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common"
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler"
import type { Request } from "express"
import type { EndpointRequest } from "@/common/context/request.interface"
import { getMcpResourceUrl, getOAuthIssuer } from "@/config/public-urls"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthAuthorizationService } from "./oauth-authorization.service"

/**
 * What the web app calls for a signed-in person: the consent page of the
 * authorization endpoint, and the list of the grants they gave.
 */
@UseGuards(JwtAuthGuard, UserGuard, ThrottlerGuard)
@SkipThrottle({ ip: true, global: true, client: true })
@Controller()
export class OAuthConsentController {
  constructor(private readonly oauthAuthorizationService: OAuthAuthorizationService) {}

  @Get(OAuthRoutes.getConsent.path)
  async getConsent(
    @Req() request: Request & EndpointRequest,
    @Query() query: Record<string, string>,
  ): Promise<typeof OAuthRoutes.getConsent.response> {
    const page = await this.oauthAuthorizationService.getConsentPage({
      userId: request.user.id,
      query,
      urls: { issuer: getOAuthIssuer(request), resource: getMcpResourceUrl(request) },
    })
    return { data: page }
  }

  @Post(OAuthRoutes.approveConsent.path)
  async approveConsent(
    @Req() request: Request & EndpointRequest,
    @Body() { payload }: typeof OAuthRoutes.approveConsent.request,
  ): Promise<typeof OAuthRoutes.approveConsent.response> {
    const { redirectTo } = await this.oauthAuthorizationService.approveConsent({
      userId: request.user.id,
      payload,
      urls: { issuer: getOAuthIssuer(request), resource: getMcpResourceUrl(request) },
    })
    return { data: { redirectTo } }
  }

  @Get(OAuthRoutes.getAllGrants.path)
  async getAllGrants(
    @Req() request: EndpointRequest,
  ): Promise<typeof OAuthRoutes.getAllGrants.response> {
    return { data: await this.oauthAuthorizationService.listGrants(request.user.id) }
  }

  @Delete(OAuthRoutes.deleteOneGrant.path)
  async deleteOneGrant(
    @Req() request: EndpointRequest,
    @Param("grantId") grantId: string,
  ): Promise<typeof OAuthRoutes.deleteOneGrant.response> {
    await this.oauthAuthorizationService.revokeGrant({ userId: request.user.id, grantId })
    return { data: { success: true } }
  }
}
