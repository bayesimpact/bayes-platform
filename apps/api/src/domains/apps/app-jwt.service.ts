import { Injectable, UnauthorizedException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  APPS_JWT_TTL_SECONDS,
  type AppJwtClaims,
  DEFAULT_APPS_JWT_AUDIENCE,
  DEFAULT_APPS_JWT_ISSUER,
  InvalidAppJwtError,
  normalizePem,
  signAppJwt,
  verifyAppJwt,
} from "./app-jwt"

@Injectable()
export class AppJwtService {
  private readonly privateKey: string
  private readonly publicKey: string
  private readonly issuer: string
  private readonly audience: string

  constructor(configService: ConfigService) {
    this.privateKey = normalizePem(configService.getOrThrow<string>("APPS_JWT_PRIVATE_KEY"))
    this.publicKey = normalizePem(configService.getOrThrow<string>("APPS_JWT_PUBLIC_KEY"))
    this.issuer = configService.get<string>("APPS_JWT_ISSUER")?.trim() || DEFAULT_APPS_JWT_ISSUER
    this.audience =
      configService.get<string>("APPS_JWT_AUDIENCE")?.trim() || DEFAULT_APPS_JWT_AUDIENCE
  }

  get ttlSeconds(): number {
    return APPS_JWT_TTL_SECONDS
  }

  sign(params: { subject: string; projectId: string; installationId: string }): string {
    return signAppJwt({
      privateKey: this.privateKey,
      issuer: this.issuer,
      audience: this.audience,
      subject: params.subject,
      projectId: params.projectId,
      installationId: params.installationId,
    })
  }

  verify(token: string): AppJwtClaims {
    try {
      return verifyAppJwt({
        token,
        publicKey: this.publicKey,
        issuer: this.issuer,
        audience: this.audience,
      })
    } catch (error) {
      if (error instanceof InvalidAppJwtError) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
      }
      throw error
    }
  }
}
