import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { Request } from "express"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { getMcpResourceUrl, getOAuthIssuer } from "@/config/public-urls"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthAuthorizationService } from "./oauth-authorization.service"
import { InvalidOAuthAccessTokenError } from "./oauth-crypto"
import type { OAuthGrantRecord } from "./oauth-grant.repository"
import { OAuthProtocolError } from "./oauth-protocol.error"

export type OAuthAuthenticatedRequest = Request & {
  user: NonNullable<Awaited<ReturnType<UsersService["findById"]>>>
  oauthGrant: OAuthGrantRecord
}

/**
 * Accepts only access tokens issued by the API's authorization server for
 * the MCP endpoint, with a grant still active. A web app (OIDC) token is
 * refused here, and a grant token is refused everywhere else.
 */
@Injectable()
export class OAuthAccessTokenGuard implements CanActivate {
  constructor(
    private readonly oauthAuthorizationService: OAuthAuthorizationService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OAuthAuthenticatedRequest>()
    const token = /^Bearer (.+)$/i.exec(request.headers.authorization ?? "")?.[1]
    if (!token) throw new UnauthorizedException(AUTH_ERRORS.NO_ACCESS_TOKEN)

    try {
      const { userId, grant } = await this.oauthAuthorizationService.verifyAccessToken(token, {
        issuer: getOAuthIssuer(request),
        resource: getMcpResourceUrl(request),
      })
      const user = await this.usersService.findById(userId)
      if (!user) throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND)
      request.user = user
      request.oauthGrant = grant
      return true
    } catch (error) {
      if (error instanceof InvalidOAuthAccessTokenError || error instanceof OAuthProtocolError) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
      }
      throw error
    }
  }
}
