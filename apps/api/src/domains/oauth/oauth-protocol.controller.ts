import { OAuthRoutes } from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { SkipThrottle, Throttle, ThrottlerGuard } from "@nestjs/throttler"
import type { Request } from "express"
import { getOAuthServerUrls } from "@/config/public-urls"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthAuthorizationService } from "./oauth-authorization.service"
import { readClientSecretBasic } from "./oauth-client-authentication"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthClientsService } from "./oauth-clients.service"
import { OAuthProtocolErrorFilter } from "./oauth-protocol.error"

const HOUR_MS = 60 * 60 * 1000

/**
 * Unauthenticated protocol endpoints of the authorization server (ADR 0028).
 * Bodies follow the RFCs (form-encoded or JSON in, snake_case out, no
 * `{ data }` envelope), and so do errors.
 */
@UseGuards(ThrottlerGuard)
@UseFilters(OAuthProtocolErrorFilter)
@SkipThrottle({ user: true })
@Controller()
export class OAuthProtocolController {
  constructor(
    private readonly oauthClientsService: OAuthClientsService,
    private readonly oauthAuthorizationService: OAuthAuthorizationService,
  ) {}

  /** RFC 7591. Anyone can register, so the limits are tight. */
  @Post(OAuthRoutes.register.path)
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  @Throttle({ ip: { limit: 10, ttl: HOUR_MS }, global: { limit: 1000, ttl: 24 * HOUR_MS } })
  @SkipThrottle({ client: true })
  register(@Body() body: unknown): Promise<typeof OAuthRoutes.register.response> {
    return this.oauthClientsService.registerClient(body)
  }

  @Post(OAuthRoutes.createToken.path)
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @SkipThrottle({ global: true })
  createToken(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<typeof OAuthRoutes.createToken.response> {
    return this.oauthAuthorizationService.createToken(
      body,
      getOAuthServerUrls(request),
      readClientSecretBasic(request),
    )
  }

  /** RFC 7009: always 200, even for an unknown token. */
  @Post(OAuthRoutes.revokeToken.path)
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ global: true })
  async revokeToken(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<typeof OAuthRoutes.revokeToken.response> {
    await this.oauthAuthorizationService.revokeToken(body, readClientSecretBasic(request))
    return {}
  }
}
