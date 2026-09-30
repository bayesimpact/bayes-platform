import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { passportJwtSecret } from "jwks-rsa"
import { ExtractJwt, type SecretOrKeyProvider, Strategy } from "passport-jwt"
import { getOidcAudience, getOidcIssuerUrl } from "./oidc-config"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OidcDiscoveryService } from "./oidc-discovery.service"

/**
 * Validates access tokens issued by the configured OIDC provider (RS256,
 * signing keys from the provider's JWKS).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(oidcDiscoveryService: OidcDiscoveryService) {
    super({
      secretOrKeyProvider: buildJwksKeyProvider(oidcDiscoveryService),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: getOidcAudience(),
      issuer: process.env.OIDC_ISSUER_URL?.trim() || undefined,
      algorithms: ["RS256"],
    })
  }

  validate(payload: unknown): unknown {
    return payload
  }
}

/**
 * The JWKS URL comes from the discovery document, which is fetched on the
 * first request rather than at boot so that the API starts even when the
 * provider is briefly unreachable.
 */
function buildJwksKeyProvider(oidcDiscoveryService: OidcDiscoveryService): SecretOrKeyProvider {
  let keyProvider: SecretOrKeyProvider | null = null
  return (request, rawJwtToken, done) => {
    if (keyProvider) {
      keyProvider(request, rawJwtToken, done)
      return
    }
    try {
      getOidcIssuerUrl()
    } catch (error) {
      done(error as Error)
      return
    }
    oidcDiscoveryService
      .getMetadata()
      .then((metadata) => {
        keyProvider ??= passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: metadata.jwks_uri,
        })
        keyProvider(request, rawJwtToken, done)
      })
      .catch((error: unknown) => done(error as Error))
  }
}
