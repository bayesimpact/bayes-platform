import { Injectable, UnauthorizedException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  InvalidOAuthAccessTokenError,
  normalizePem,
  verifyOAuthAccessToken,
} from "@/domains/oauth/oauth-crypto"

/**
 * Checks the access tokens the authorization server issues to apps
 * (ADR 0029): an `at+jwt` signed with the server's key, for the apps API.
 */
@Injectable()
export class AppAccessTokenService {
  private readonly publicKey: string

  constructor(configService: ConfigService) {
    this.publicKey = normalizePem(configService.getOrThrow<string>("OAUTH_SIGNING_PUBLIC_KEY"))
  }

  verify(
    token: string,
    urls: { issuer: string; appsResource: string },
  ): { serviceUserId: string; installationId: string } {
    try {
      const claims = verifyOAuthAccessToken({
        token,
        publicKey: this.publicKey,
        issuer: urls.issuer,
        audience: urls.appsResource,
      })
      if (!claims.installation_id) throw new InvalidOAuthAccessTokenError()
      return { serviceUserId: claims.sub, installationId: claims.installation_id }
    } catch (error) {
      if (error instanceof InvalidOAuthAccessTokenError) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
      }
      throw error
    }
  }
}
