import { createPrivateKey, randomUUID } from "node:crypto"
import {
  isAllowedInstallRedirectUri,
  OAUTH_GRANTABLE_PERMISSIONS,
  type OAuthAuthorizationRequestDto,
  type OAuthConsentDto,
  type OAuthConsentPageDto,
  type OAuthGrantDto,
  type OAuthTokenResponseDto,
  oauthAuthorizationRequestSchema,
  oauthConsentSchema,
  oauthRedirectUriMatches,
  oauthRevocationRequestSchema,
  oauthTokenRequestSchema,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { AppManifestRecord } from "@/domains/apps/app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "@/domains/apps/apps.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OAuthAuthorizationCodeRepository } from "./oauth-authorization-code.repository"
import type { OAuthClientCredentials } from "./oauth-client-authentication"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  isAppClientId,
  OAuthClientsService,
  type ResolvedOAuthClient,
} from "./oauth-clients.service"
import {
  generateOpaqueToken,
  hashOpaqueToken,
  normalizePem,
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

const DAY_MS = 24 * 60 * 60 * 1000
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const OAUTH_REFRESH_TOKEN_TTL_MS = 7 * DAY_MS
/** An app runs unattended: longer tokens, and a refresh token that lives while it is used. */
export const APP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
export const APP_REFRESH_TOKEN_TTL_MS = 90 * DAY_MS
const OAUTH_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000

/** The URLs that depend on the host the request came to. */
export type OAuthServerUrls = {
  issuer: string
  /** The MCP endpoint, the resource of the tokens of MCP clients. */
  resource: string
  /** The apps API, the resource of the tokens of apps (ADR 0029). */
  appsResource: string
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
    private readonly appsService: AppsService,
    private readonly transactionService: TransactionService,
  ) {
    // One key pair signs every token of the authorization server, MCP and apps alike.
    this.privateKey = normalizePem(configService.getOrThrow<string>("OAUTH_SIGNING_PRIVATE_KEY"))
    this.publicKey = normalizePem(configService.getOrThrow<string>("OAUTH_SIGNING_PUBLIC_KEY"))
    // Said at startup rather than at the first token request: the rest of the
    // API keeps working, but no OAuth client can sign in until it is fixed.
    try {
      createPrivateKey(this.privateKey)
    } catch {
      this.logger.error(
        "OAUTH_SIGNING_PRIVATE_KEY is not a PEM private key: OAuth tokens cannot be issued",
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
    const projects = client.app
      ? await this.listAppInstallProjects(params.userId, client.app)
      : await this.listConsentProjects(params.userId)
    return {
      client: {
        clientId: client.clientId,
        kind: client.app ? "app" : "mcp",
        name: client.clientName,
        redirectHost: new URL(request.redirect_uri).host,
        verified: client.verified,
        description: client.app?.description ?? null,
        logoUrl: client.app?.logoUrl ?? null,
      },
      projects,
      grantablePermissions: client.app
        ? client.app.grantablePermissions
        : [...OAUTH_GRANTABLE_PERMISSIONS],
    }
  }

  /** The person approved: a grant and a code, and the URL that brings the code back to the client. */
  async approveConsent(params: {
    userId: string
    payload: unknown
    urls: OAuthServerUrls
  }): Promise<{ redirectTo: string; grantId: string; appInstallationId: string | null }> {
    const consent = parseOrBadRequest(oauthConsentSchema, params.payload)
    const { client } = await this.checkAuthorizationRequest(consent, params.urls)
    const permissions = [...new Set(consent.permissions)]

    const { grant, appInstallationId } = await this.transactionService.run(async () => {
      if (client.app) {
        return this.installApp({
          userId: params.userId,
          client,
          app: client.app,
          consent,
          urls: params.urls,
        })
      }
      const isGrantable = (permission: string) =>
        (OAUTH_GRANTABLE_PERMISSIONS as readonly string[]).includes(permission)
      if (!permissions.every(isGrantable)) throw new BadRequestException("Unknown permission")
      const readableProjectIds = new Set(
        await this.permissionService.listResourceIds(params.userId, PROJECT_READ_PERMISSION),
      )
      const projectIds = [...new Set(consent.projectIds)]
      if (projectIds.some((projectId) => !readableProjectIds.has(projectId))) {
        throw new NotFoundException("Project not found")
      }
      const mcpGrant = await this.oauthGrantRepository.createGrant({
        userId: params.userId,
        oauthClientId: client.id,
        projectIds,
        permissions,
        resource: params.urls.resource,
      })
      return { grant: mcpGrant, appInstallationId: null }
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
    return { redirectTo: redirectTo.toString(), grantId: grant.id, appInstallationId }
  }

  /**
   * Token endpoint: authorization code with PKCE, or refresh token rotation.
   * An app authenticates with its secret, from the Authorization header
   * (`client_secret_basic`) or the body (`client_secret_post`).
   */
  async createToken(
    body: unknown,
    urls: OAuthServerUrls,
    basicCredentials: OAuthClientCredentials = null,
  ): Promise<OAuthTokenResponseDto> {
    const grantType = (body as { grant_type?: unknown } | undefined)?.grant_type
    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      throw new OAuthProtocolError("unsupported_grant_type")
    }
    const parsed = oauthTokenRequestSchema.safeParse(withBasicCredentials(body, basicCredentials))
    if (!parsed.success) {
      throw new OAuthProtocolError("invalid_request", "Missing or malformed parameters")
    }
    const request = parsed.data
    await this.authenticateClient(request.client_id, request.client_secret)

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
        grant.resource === resourceOf(grant, urls) &&
        isRequestedResource(request.resource, grant, urls) &&
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
    if (
      !grant ||
      grant.client.clientId !== request.client_id ||
      grant.resource !== resourceOf(grant, urls) ||
      !isRequestedResource(request.resource, grant, urls)
    ) {
      throw new OAuthProtocolError("invalid_grant")
    }
    const isFirstUse =
      refreshToken.usedAt === null &&
      (await this.oauthRefreshTokenRepository.markUsed({ id: refreshToken.id, usedAt: new Date() }))
    if (!isFirstUse) {
      // A rotated token came back: it leaked, or the client was copied. Cut the grant.
      // An app keeps its installation: a reconnection restores it with its conversations
      // and documents, and a lost token response can look like a reuse.
      await this.oauthGrantRepository.revoke({ id: grant.id, revokedAt: new Date() })
      this.logger.warn(`Refresh token reused, grant ${grant.id} revoked`)
      throw new OAuthProtocolError("invalid_grant")
    }
    if (refreshToken.expiresAt.getTime() <= Date.now()) {
      throw new OAuthProtocolError("invalid_grant")
    }
    return this.issueTokens(grant, urls)
  }

  /**
   * RFC 7009: revoking a refresh token ends its grant, and the installation of
   * an app. Unknown tokens are not an error.
   */
  async revokeToken(body: unknown, basicCredentials: OAuthClientCredentials = null): Promise<void> {
    const parsed = oauthRevocationRequestSchema.safeParse(
      withBasicCredentials(body, basicCredentials),
    )
    if (!parsed.success) throw new OAuthProtocolError("invalid_request")
    await this.authenticateClient(parsed.data.client_id, parsed.data.client_secret)
    const refreshToken = await this.oauthRefreshTokenRepository.findByHash(
      hashOpaqueToken(parsed.data.token),
    )
    if (!refreshToken) return
    const grant = await this.oauthGrantRepository.findActiveById(refreshToken.oauthGrantId)
    if (grant && grant.client.clientId === parsed.data.client_id) {
      await this.revokeGrantAndInstallation(grant)
    }
  }

  /**
   * Checks an MCP access token and loads its grant, every time: a revoked
   * grant stops at once, even with a token still valid. App tokens are
   * checked by the apps API (`AppGuard`).
   */
  async verifyAccessToken(
    token: string,
    urls: Pick<OAuthServerUrls, "issuer" | "resource">,
  ): Promise<VerifiedOAuthAccess> {
    const claims: OAuthAccessTokenClaims = verifyOAuthAccessToken({
      token,
      publicKey: this.publicKey,
      issuer: urls.issuer,
      audience: urls.resource,
    })
    const grant = await this.oauthGrantRepository.findActiveById(claims.grant_id)
    if (
      !grant ||
      grant.appInstallationId !== null ||
      grant.userId !== claims.sub ||
      grant.client.clientId !== claims.client_id
    ) {
      throw new OAuthProtocolError("invalid_grant", "The grant of this token was revoked")
    }
    await this.oauthGrantRepository.markUsed({ id: grant.id, usedAt: new Date() })
    return { userId: claims.sub, grant }
  }

  /** The grants a person gave to MCP clients. */
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

  /**
   * Installs an app on the one project picked: the person must be allowed to
   * install there, and can only grant what the manifest offers and they hold.
   */
  private async installApp(params: {
    userId: string
    client: ResolvedOAuthClient
    app: AppManifestRecord
    consent: OAuthConsentDto
    urls: OAuthServerUrls
  }): Promise<{ grant: OAuthGrantRecord; appInstallationId: string }> {
    const { userId, client, app, consent } = params
    const [projectId, ...otherProjectIds] = [...new Set(consent.projectIds)]
    if (!projectId || otherProjectIds.length > 0) {
      throw new BadRequestException("An app is installed on one project at a time")
    }
    const project = { type: "project" as const, id: projectId }
    if (
      !(await this.permissionService.has(
        userId,
        PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
        project,
      ))
    ) {
      throw new NotFoundException("Project not found")
    }
    const permissions = [...new Set(consent.permissions)]
    if (permissions.some((permission) => !app.grantablePermissions.includes(permission))) {
      throw new BadRequestException("This app cannot be granted these permissions")
    }
    for (const permission of permissions) {
      if (!(await this.permissionService.has(userId, permission, project))) {
        throw new ForbiddenException("You can only grant the permissions you hold on this project")
      }
    }

    const installed = await this.appsService.installApprovedApp({
      appManifestId: app.id,
      projectId,
      permissions,
      userId,
    })
    if (installed.reconnected) {
      // The app gets one live grant: the refresh tokens it held before stop working.
      await this.oauthGrantRepository.revokeByAppInstallationId({
        appInstallationId: installed.installationId,
        revokedAt: new Date(),
      })
    }
    // The installation records who installed it; the grant belongs to no person.
    const grant = await this.oauthGrantRepository.createGrant({
      userId: null,
      oauthClientId: client.id,
      projectIds: [projectId],
      permissions,
      resource: params.urls.appsResource,
      appInstallationId: installed.installationId,
    })
    return { grant, appInstallationId: installed.installationId }
  }

  /** An app proves who it is with its secret. A public client has none to send. */
  private async authenticateClient(clientId: string, clientSecret: string | undefined) {
    if (isAppClientId(clientId)) {
      if (!(await this.oauthClientsService.verifyAppClientSecret(clientId, clientSecret))) {
        throw new OAuthProtocolError("invalid_client")
      }
      return
    }
    if (clientSecret !== undefined) throw new OAuthProtocolError("invalid_client")
  }

  /** Ends a grant, and with an app's grant the installation and its access. */
  private async revokeGrantAndInstallation(grant: OAuthGrantRecord): Promise<void> {
    await this.oauthGrantRepository.revoke({ id: grant.id, revokedAt: new Date() })
    if (grant.appInstallationId) {
      await this.appsService.revokeInstallation({
        installationId: grant.appInstallationId,
        userId: null,
      })
    }
  }

  private async checkAuthorizationRequest(
    request: OAuthAuthorizationRequestDto,
    urls: OAuthServerUrls,
  ): Promise<{ client: ResolvedOAuthClient }> {
    const client = await this.oauthClientsService.resolveClient(request.client_id)
    if (!client) throw new BadRequestException("Unknown client")
    const isRegisteredRedirect = client.app
      ? isAllowedInstallRedirectUri(request.redirect_uri, client.redirectUris)
      : client.redirectUris.some((registered) =>
          oauthRedirectUriMatches(registered, request.redirect_uri),
        )
    if (!isRegisteredRedirect) {
      throw new BadRequestException("This redirect URI is not registered for the client")
    }
    const resource = client.app ? urls.appsResource : urls.resource
    if (request.resource !== undefined && request.resource !== resource) {
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

  /** The projects the person can install the app on, and what they can grant it there. */
  private async listAppInstallProjects(
    userId: string,
    app: AppManifestRecord,
  ): Promise<OAuthConsentPageDto["projects"]> {
    const readableProjectIds = await this.permissionService.listResourceIds(
      userId,
      PROJECT_READ_PERMISSION,
    )
    const installableProjectIds: string[] = []
    for (const projectId of readableProjectIds) {
      const canInstall = await this.permissionService.has(
        userId,
        PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
        { type: "project", id: projectId },
      )
      if (canInstall) installableProjectIds.push(projectId)
    }
    const projects = await this.projectRepository.findPickerProjectsByIds(installableProjectIds)
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        availablePermissions: await this.filterHeldPermissions(
          userId,
          project.id,
          app.grantablePermissions,
        ),
      })),
    )
  }

  /**
   * The grantable permissions worth offering on a project. Agent settings are
   * held agent by agent (owner or admin of the agent), so they are offered on
   * every visible project and checked on each agent when the client uses them.
   */
  private async listHeldPermissions(userId: string, projectId: string): Promise<string[]> {
    const isHeldPerAgent = (permission: string) => permission === "agent.settings.draft.update"
    const held = await this.filterHeldPermissions(
      userId,
      projectId,
      OAUTH_GRANTABLE_PERMISSIONS.filter((permission) => !isHeldPerAgent(permission)),
    )
    return OAUTH_GRANTABLE_PERMISSIONS.filter(
      (permission) => isHeldPerAgent(permission) || held.includes(permission),
    )
  }

  private async filterHeldPermissions(
    userId: string,
    projectId: string,
    permissions: readonly string[],
  ): Promise<string[]> {
    const held = await Promise.all(
      permissions.map(async (permission) =>
        (await this.permissionService.has(userId, permission, { type: "project", id: projectId }))
          ? [permission]
          : [],
      ),
    )
    return held.flat()
  }

  private async issueTokens(
    grant: OAuthGrantRecord,
    urls: OAuthServerUrls,
  ): Promise<OAuthTokenResponseDto> {
    const subject = grant.appInstallationId
      ? await this.requireActiveInstallationUser(grant)
      : requireUserId(grant)
    const accessTokenTtlSeconds = grant.appInstallationId
      ? APP_ACCESS_TOKEN_TTL_SECONDS
      : OAUTH_ACCESS_TOKEN_TTL_SECONDS
    const refreshTokenTtlMs = grant.appInstallationId
      ? APP_REFRESH_TOKEN_TTL_MS
      : OAUTH_REFRESH_TOKEN_TTL_MS

    const issuedAt = Math.floor(Date.now() / 1000)
    const scope = grant.permissions.join(" ")
    const accessToken = signOAuthAccessToken(
      {
        iss: urls.issuer,
        aud: resourceOf(grant, urls),
        sub: subject,
        client_id: grant.client.clientId,
        grant_id: grant.id,
        ...(grant.appInstallationId && { installation_id: grant.appInstallationId }),
        scope,
        iat: issuedAt,
        exp: issuedAt + accessTokenTtlSeconds,
        jti: randomUUID(),
      },
      this.privateKey,
    )
    const refreshToken = generateOpaqueToken()
    await this.oauthRefreshTokenRepository.createToken({
      tokenHash: hashOpaqueToken(refreshToken),
      oauthGrantId: grant.id,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    })
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope,
    }
  }

  /** An app's tokens are its service user's, while the installation is active. */
  private async requireActiveInstallationUser(grant: OAuthGrantRecord): Promise<string> {
    const serviceUserId = grant.appInstallationId
      ? await this.appsService.findActiveServiceUserId(grant.appInstallationId)
      : null
    if (!serviceUserId) {
      // Revoked from the studio: the grant goes with it.
      await this.oauthGrantRepository.revoke({ id: grant.id, revokedAt: new Date() })
      throw new OAuthProtocolError("invalid_grant")
    }
    return serviceUserId
  }
}

/** The person an MCP client acts as. */
function requireUserId(grant: OAuthGrantRecord): string {
  if (!grant.userId) throw new OAuthProtocolError("invalid_grant")
  return grant.userId
}

/** The resource a grant's tokens are for: the apps API for an app, the MCP endpoint otherwise. */
function resourceOf(grant: OAuthGrantRecord, urls: OAuthServerUrls): string {
  return grant.appInstallationId ? urls.appsResource : urls.resource
}

function isRequestedResource(
  requested: string | undefined,
  grant: OAuthGrantRecord,
  urls: OAuthServerUrls,
): boolean {
  return requested === undefined || requested === resourceOf(grant, urls)
}

/**
 * RFC 6749 section 2.3.1: credentials in the Authorization header take the
 * place of the body's. A body naming another client is refused.
 */
function withBasicCredentials(body: unknown, credentials: OAuthClientCredentials): unknown {
  if (!credentials) return body
  const fields = (body ?? {}) as Record<string, unknown>
  if (
    (fields.client_id !== undefined && fields.client_id !== credentials.clientId) ||
    fields.client_secret !== undefined
  ) {
    throw new OAuthProtocolError("invalid_request", "Use one client authentication method")
  }
  return { ...fields, client_id: credentials.clientId, client_secret: credentials.clientSecret }
}

function parseOrBadRequest<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new BadRequestException("Invalid authorization request")
  return parsed.data
}
