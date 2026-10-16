import { createPrivateKey, randomUUID } from "node:crypto"
import {
  OAUTH_GRANTABLE_PERMISSIONS,
  type OAuthAuthorizationRequestDto,
  type OAuthConsentPageDto,
  type OAuthGrantablePermission,
  type OAuthGrantDto,
  type OAuthTokenResponseDto,
  oauthAuthorizationRequestSchema,
  oauthConsentSchema,
  oauthRedirectUriMatches,
  oauthRevocationRequestSchema,
  oauthTokenRequestSchema,
} from "@caseai-connect/api-contracts"
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { normalizePem } from "@/domains/apps/app-jwt"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthAuthorizationCodeRepository } from "./oauth-authorization-code.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthClientsService, type ResolvedOAuthClient } from "./oauth-clients.service"
import {
  generateOpaqueToken,
  hashOpaqueToken,
  type OAuthAccessTokenClaims,
  pkceS256Matches,
  signOAuthAccessToken,
  verifyOAuthAccessToken,
} from "./oauth-crypto"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type OAuthGrantRecord, OAuthGrantRepository } from "./oauth-grant.repository"
import { OAuthProtocolError } from "./oauth-protocol.error"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthRefreshTokenRepository } from "./oauth-refresh-token.repository"

export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const OAUTH_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const OAUTH_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000

/** The URLs that depend on the host the request came to. */
export type OAuthServerUrls = {
  issuer: string
  /** The protected resource the tokens are for (the MCP endpoint today). */
  resource: string
}

export type VerifiedOAuthAccess = {
  userId: string
  grant: OAuthGrantRecord
}

@Injectable()
export class OAuthAuthorizationService {
  private readonly logger = new Logger(OAuthAuthorizationService.name)
  private readonly privateKey: string
  private readonly publicKey: string

  constructor(
    configService: ConfigService,
    private readonly oauthClientsService: OAuthClientsService,
    private readonly oauthGrantRepository: OAuthGrantRepository,
    private readonly oauthAuthorizationCodeRepository: OAuthAuthorizationCodeRepository,
    private readonly oauthRefreshTokenRepository: OAuthRefreshTokenRepository,
    private readonly permissionService: PermissionService,
    private readonly projectRepository: ProjectRepository,
  ) {
    // The apps key pair is the authorization server's key (ADR 0028).
    this.privateKey = normalizePem(configService.getOrThrow<string>("APPS_JWT_PRIVATE_KEY"))
    this.publicKey = normalizePem(configService.getOrThrow<string>("APPS_JWT_PUBLIC_KEY"))
    // Said at startup rather than at the first token request: the rest of the
    // API keeps working, but no OAuth client can sign in until it is fixed.
    try {
      createPrivateKey(this.privateKey)
    } catch {
      this.logger.error(
        "APPS_JWT_PRIVATE_KEY is not a PEM private key: OAuth tokens cannot be issued",
      )
    }
  }

  /**
   * What the consent page shows. The request is checked before the person
   * sees anything; a bad client or redirect URI is not sent back to the
   * client, since the redirect URI cannot be trusted.
   */
  async getConsentPage(params: {
    userId: string
    query: unknown
    urls: OAuthServerUrls
  }): Promise<OAuthConsentPageDto> {
    const request = parseOrBadRequest(oauthAuthorizationRequestSchema, params.query)
    const { client } = await this.checkAuthorizationRequest(request, params.urls)
    const projects = await this.listConsentProjects(params.userId)
    return {
      client: {
        clientId: client.clientId,
        name: client.clientName,
        redirectHost: new URL(request.redirect_uri).host,
        verified: client.verified,
      },
      projects,
      grantablePermissions: [...OAUTH_GRANTABLE_PERMISSIONS],
    }
  }

  /** The person approved: a grant and a code, and the URL that brings the code back to the client. */
  async approveConsent(params: {
    userId: string
    payload: unknown
    urls: OAuthServerUrls
  }): Promise<{ redirectTo: string; grantId: string }> {
    const consent = parseOrBadRequest(oauthConsentSchema, params.payload)
    const { client } = await this.checkAuthorizationRequest(consent, params.urls)

    const readableProjectIds = new Set(
      await this.permissionService.listResourceIds(params.userId, PROJECT_READ_PERMISSION),
    )
    const projectIds = [...new Set(consent.projectIds)]
    if (projectIds.some((projectId) => !readableProjectIds.has(projectId))) {
      throw new NotFoundException("Project not found")
    }

    const grant = await this.oauthGrantRepository.createGrant({
      userId: params.userId,
      oauthClientId: client.id,
      projectIds,
      permissions: [...new Set(consent.permissions)],
      resource: params.urls.resource,
    })
    const code = generateOpaqueToken()
    await this.oauthAuthorizationCodeRepository.createCode({
      codeHash: hashOpaqueToken(code),
      oauthGrantId: grant.id,
      redirectUri: consent.redirect_uri,
      codeChallenge: consent.code_challenge,
      expiresAt: new Date(Date.now() + OAUTH_AUTHORIZATION_CODE_TTL_MS),
    })
    this.logger.log(`Grant ${grant.id} given to client ${client.id} by user ${params.userId}`)

    const redirectTo = new URL(consent.redirect_uri)
    redirectTo.searchParams.set("code", code)
    if (consent.state !== undefined) redirectTo.searchParams.set("state", consent.state)
    // RFC 9207: tells the client which server answered, against mix-up attacks.
    redirectTo.searchParams.set("iss", params.urls.issuer)
    return { redirectTo: redirectTo.toString(), grantId: grant.id }
  }

  /** Token endpoint: authorization code with PKCE, or refresh token rotation. */
  async createToken(body: unknown, urls: OAuthServerUrls): Promise<OAuthTokenResponseDto> {
    const grantType = (body as { grant_type?: unknown } | undefined)?.grant_type
    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      throw new OAuthProtocolError("unsupported_grant_type")
    }
    const parsed = oauthTokenRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new OAuthProtocolError("invalid_request", "Missing or malformed parameters")
    }
    const request = parsed.data
    if (request.resource !== undefined && request.resource !== urls.resource) {
      throw new OAuthProtocolError("invalid_target")
    }

    if (request.grant_type === "authorization_code") {
      const code = await this.oauthAuthorizationCodeRepository.findUnconsumedByHash(
        hashOpaqueToken(request.code),
      )
      const grant = code ? await this.oauthGrantRepository.findActiveById(code.oauthGrantId) : null
      const isValid =
        code &&
        grant &&
        code.expiresAt.getTime() > Date.now() &&
        grant.client.clientId === request.client_id &&
        code.redirectUri === request.redirect_uri &&
        grant.resource === urls.resource &&
        pkceS256Matches(request.code_verifier, code.codeChallenge)
      if (!isValid) throw new OAuthProtocolError("invalid_grant")
      if (
        !(await this.oauthAuthorizationCodeRepository.consume({
          id: code.id,
          consumedAt: new Date(),
        }))
      ) {
        throw new OAuthProtocolError("invalid_grant")
      }
      return this.issueTokens(grant, urls)
    }

    const refreshToken = await this.oauthRefreshTokenRepository.findByHash(
      hashOpaqueToken(request.refresh_token),
    )
    if (!refreshToken) throw new OAuthProtocolError("invalid_grant")
    const grant = await this.oauthGrantRepository.findActiveById(refreshToken.oauthGrantId)
    if (!grant || grant.client.clientId !== request.client_id || grant.resource !== urls.resource) {
      throw new OAuthProtocolError("invalid_grant")
    }
    const isFirstUse =
      refreshToken.usedAt === null &&
      (await this.oauthRefreshTokenRepository.markUsed({ id: refreshToken.id, usedAt: new Date() }))
    if (!isFirstUse) {
      // A rotated token came back: it leaked, or the client was copied. Cut the grant.
      await this.oauthGrantRepository.revoke({ id: grant.id, revokedAt: new Date() })
      this.logger.warn(`Refresh token reused, grant ${grant.id} revoked`)
      throw new OAuthProtocolError("invalid_grant")
    }
    if (refreshToken.expiresAt.getTime() <= Date.now()) {
      throw new OAuthProtocolError("invalid_grant")
    }
    return this.issueTokens(grant, urls)
  }

  /** RFC 7009: revoking a refresh token ends its grant. Unknown tokens are not an error. */
  async revokeToken(body: unknown): Promise<void> {
    const parsed = oauthRevocationRequestSchema.safeParse(body)
    if (!parsed.success) throw new OAuthProtocolError("invalid_request")
    const refreshToken = await this.oauthRefreshTokenRepository.findByHash(
      hashOpaqueToken(parsed.data.token),
    )
    if (!refreshToken) return
    const grant = await this.oauthGrantRepository.findActiveById(refreshToken.oauthGrantId)
    if (grant && grant.client.clientId === parsed.data.client_id) {
      await this.oauthGrantRepository.revoke({ id: grant.id, revokedAt: new Date() })
    }
  }

  /**
   * Checks an access token for the resource and loads its grant, every time:
   * a revoked grant stops at once, even with a token still valid.
   */
  async verifyAccessToken(token: string, urls: OAuthServerUrls): Promise<VerifiedOAuthAccess> {
    const claims: OAuthAccessTokenClaims = verifyOAuthAccessToken({
      token,
      publicKey: this.publicKey,
      issuer: urls.issuer,
      audience: urls.resource,
    })
    const grant = await this.oauthGrantRepository.findActiveById(claims.grant_id)
    if (!grant || grant.userId !== claims.sub || grant.client.clientId !== claims.client_id) {
      throw new OAuthProtocolError("invalid_grant", "The grant of this token was revoked")
    }
    await this.oauthGrantRepository.markUsed({ id: grant.id, usedAt: new Date() })
    return { userId: claims.sub, grant }
  }

  async listGrants(userId: string): Promise<OAuthGrantDto[]> {
    const grants = await this.oauthGrantRepository.listActiveByUserId(userId)
    return grants.map((grant) => ({
      id: grant.id,
      client: {
        clientId: grant.client.clientId,
        name: grant.client.clientName,
        verified: grant.client.registrationType === "cimd",
      },
      projects: grant.projects,
      permissions: grant.permissions,
      createdAt: grant.createdAt.getTime(),
      lastUsedAt: grant.lastUsedAt?.getTime() ?? null,
    }))
  }

  async revokeGrant(params: { userId: string; grantId: string }): Promise<void> {
    const isRevoked = await this.oauthGrantRepository.revokeForUser({
      id: params.grantId,
      userId: params.userId,
      revokedAt: new Date(),
    })
    if (!isRevoked) throw new NotFoundException("Grant not found")
  }

  private async checkAuthorizationRequest(
    request: OAuthAuthorizationRequestDto,
    urls: OAuthServerUrls,
  ): Promise<{ client: ResolvedOAuthClient }> {
    const client = await this.oauthClientsService.resolveClient(request.client_id)
    if (!client) throw new BadRequestException("Unknown client")
    const isRegisteredRedirect = client.redirectUris.some((registered) =>
      oauthRedirectUriMatches(registered, request.redirect_uri),
    )
    if (!isRegisteredRedirect) {
      throw new BadRequestException("This redirect URI is not registered for the client")
    }
    if (request.resource !== undefined && request.resource !== urls.resource) {
      throw new BadRequestException("Unknown resource")
    }
    return { client }
  }

  private async listConsentProjects(userId: string): Promise<OAuthConsentPageDto["projects"]> {
    const projectIds = await this.permissionService.listResourceIds(userId, PROJECT_READ_PERMISSION)
    const projects = await this.projectRepository.findPickerProjectsByIds(projectIds)
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        availablePermissions: await this.listHeldPermissions(userId, project.id),
      })),
    )
  }

  /**
   * The grantable permissions worth offering on a project. Agent settings are
   * held agent by agent (owner or admin of the agent), so they are offered on
   * every visible project and checked on each agent when the client uses them.
   */
  private async listHeldPermissions(
    userId: string,
    projectId: string,
  ): Promise<OAuthGrantablePermission[]> {
    const held = await Promise.all(
      OAUTH_GRANTABLE_PERMISSIONS.map(async (permission) => {
        if (permission === "agent.settings.draft.update") return [permission]
        const isHeld = await this.permissionService.has(userId, permission, {
          type: "project",
          id: projectId,
        })
        return isHeld ? [permission] : []
      }),
    )
    return held.flat()
  }

  private async issueTokens(
    grant: OAuthGrantRecord,
    urls: OAuthServerUrls,
  ): Promise<OAuthTokenResponseDto> {
    const issuedAt = Math.floor(Date.now() / 1000)
    const scope = grant.permissions.join(" ")
    const accessToken = signOAuthAccessToken(
      {
        iss: urls.issuer,
        aud: urls.resource,
        sub: grant.userId,
        client_id: grant.client.clientId,
        grant_id: grant.id,
        scope,
        iat: issuedAt,
        exp: issuedAt + OAUTH_ACCESS_TOKEN_TTL_SECONDS,
        jti: randomUUID(),
      },
      this.privateKey,
    )
    const refreshToken = generateOpaqueToken()
    await this.oauthRefreshTokenRepository.createToken({
      tokenHash: hashOpaqueToken(refreshToken),
      oauthGrantId: grant.id,
      expiresAt: new Date(Date.now() + OAUTH_REFRESH_TOKEN_TTL_MS),
    })
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope,
    }
  }
}

function parseOrBadRequest<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new BadRequestException("Invalid authorization request")
  return parsed.data
}
