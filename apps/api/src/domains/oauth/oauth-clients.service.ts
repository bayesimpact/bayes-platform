import { randomBytes } from "node:crypto"
import {
  isAllowedOAuthRedirectUri,
  OAUTH_MAX_REDIRECT_URIS,
  type OAuthClientRegistrationResponseDto,
  oauthClientRegistrationSchema,
} from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import { z } from "zod"
import type { AppManifestRecord } from "@/domains/apps/app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppManifestRepository } from "@/domains/apps/app-manifest.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "@/domains/apps/apps.service"
import {
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
} from "@/domains/apps/client-credentials"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  ClientMetadataDocumentError,
  ClientMetadataDocumentFetcher,
  parseClientMetadataDocumentUrl,
} from "./client-metadata-document.fetcher"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type OAuthClientRecord, OAuthClientRepository } from "./oauth-client.repository"
import { generateOpaqueToken } from "./oauth-crypto"
import { OAuthProtocolError } from "./oauth-protocol.error"

/** A cimd document is fetched again after an hour. */
const CLIENT_METADATA_DOCUMENT_TTL_MS = 60 * 60 * 1000
const DCR_CLIENT_ID_PREFIX = "dcr_"
const APP_CLIENT_ID_PREFIX = "app_"
let dummyClientSecretHash: Promise<string> | undefined
/** A dcr client nobody approved within a day is deleted. */
const UNUSED_DCR_CLIENT_TTL_MS = 24 * 60 * 60 * 1000

const clientMetadataDocumentSchema = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(200).optional(),
  redirect_uris: z
    .array(z.string().max(2048).refine(isAllowedOAuthRedirectUri))
    .min(1)
    .max(OAUTH_MAX_REDIRECT_URIS),
  token_endpoint_auth_method: z.literal("none").optional(),
})

export type ResolvedOAuthClient = OAuthClientRecord & {
  /**
   * The domain of a cimd client is the domain of its id, and an app is
   * registered by the platform; a dcr client declares itself.
   */
  verified: boolean
  /** The manifest of an app client (ADR 0029), which gives its name and redirect URIs. */
  app: AppManifestRecord | null
}

/** App clients are confidential: they authenticate with their secret (ADR 0029). */
export function isAppClientId(clientId: string): boolean {
  return clientId.startsWith(APP_CLIENT_ID_PREFIX)
}

@Injectable()
export class OAuthClientsService {
  private readonly logger = new Logger(OAuthClientsService.name)

  constructor(
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly clientMetadataDocumentFetcher: ClientMetadataDocumentFetcher,
    private readonly appManifestRepository: AppManifestRepository,
    private readonly appsService: AppsService,
  ) {}

  /** The client id of an app, null until its first secret is created. */
  async getAppClientId(appManifestId: string): Promise<string | null> {
    await this.appsService.getAppManifest(appManifestId)
    const client = await this.oauthClientRepository.findByAppManifestId(appManifestId)
    return client?.clientId ?? null
  }

  /**
   * Creates the OAuth client of an app, or replaces its secret. The previous
   * secret stops working at once. The new one is returned this once.
   */
  async createAppClientSecret(
    appManifestId: string,
  ): Promise<{ clientId: string; clientSecret: string }> {
    return this.setAppClientSecret(appManifestId, generateClientSecret())
  }

  /**
   * Creates the OAuth client of an app, or replaces its secret, with a secret the caller holds:
   * for scripts and dev tooling, which keep the secret an app already runs with.
   */
  async setAppClientSecret(
    appManifestId: string,
    clientSecret: string,
  ): Promise<{ clientId: string; clientSecret: string }> {
    await this.appsService.getAppManifest(appManifestId)
    const clientSecretHash = await hashClientSecret(clientSecret)
    const existing = await this.oauthClientRepository.findByAppManifestId(appManifestId)
    if (existing) {
      await this.oauthClientRepository.updateClientSecretHash(existing.id, clientSecretHash)
      this.logger.log(`Secret of app client ${existing.clientId} replaced`)
      return { clientId: existing.clientId, clientSecret }
    }
    const created = await this.oauthClientRepository.createAppClient({
      clientId: `${APP_CLIENT_ID_PREFIX}${randomBytes(16).toString("hex")}`,
      appManifestId,
      clientSecretHash,
    })
    this.logger.log(`App client ${created.clientId} created for app ${appManifestId}`)
    return { clientId: created.clientId, clientSecret }
  }

  /**
   * Checks the secret of an app client. Takes as long for an unknown client,
   * so the answer does not tell which client ids exist.
   */
  async verifyAppClientSecret(
    clientId: string,
    clientSecret: string | undefined,
  ): Promise<boolean> {
    const client = isAppClientId(clientId)
      ? await this.oauthClientRepository.findByClientId(clientId)
      : null
    const storedHash = client?.clientSecretHash ?? (await dummySecretHash())
    const secretMatches = await verifyClientSecret(clientSecret ?? "", storedHash)
    return Boolean(client?.clientSecretHash && clientSecret && secretMatches)
  }

  /** RFC 7591 dynamic client registration of a public client. */
  async registerClient(body: unknown): Promise<OAuthClientRegistrationResponseDto> {
    const parsed = oauthClientRegistrationSchema.safeParse(body)
    if (!parsed.success) {
      throw new OAuthProtocolError(
        "invalid_client_metadata",
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      )
    }
    await this.deleteStaleRows()
    const client = await this.oauthClientRepository.createClient({
      clientId: `${DCR_CLIENT_ID_PREFIX}${generateOpaqueToken()}`,
      registrationType: "dcr",
      clientName: parsed.data.client_name ?? null,
      redirectUris: parsed.data.redirect_uris,
      metadataFetchedAt: null,
    })
    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      ...(client.clientName && { client_name: client.clientName }),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: parsed.data.grant_types,
      response_types: parsed.data.response_types,
    }
  }

  /**
   * The client behind a client id: a registered dcr client, or a cimd client
   * whose document is fetched (and kept an hour). Null for an unknown id.
   */
  async resolveClient(clientId: string): Promise<ResolvedOAuthClient | null> {
    if (isAppClientId(clientId)) return this.resolveAppClient(clientId)
    const documentUrl = parseClientMetadataDocumentUrl(clientId)
    if (!documentUrl) {
      const client = clientId.startsWith(DCR_CLIENT_ID_PREFIX)
        ? await this.oauthClientRepository.findByClientId(clientId)
        : null
      return client?.registrationType === "dcr" ? { ...client, verified: false, app: null } : null
    }

    const stored = await this.oauthClientRepository.findByClientId(clientId)
    const isFresh =
      stored?.metadataFetchedAt &&
      Date.now() - stored.metadataFetchedAt.getTime() < CLIENT_METADATA_DOCUMENT_TTL_MS
    if (stored && isFresh) return { ...stored, verified: true, app: null }

    const document = await this.fetchClientMetadataDocument(documentUrl)
    if (!document) return null

    const fields = {
      clientName: document.client_name ?? null,
      redirectUris: document.redirect_uris,
      metadataFetchedAt: new Date(),
    }
    if (stored) {
      await this.oauthClientRepository.updateClientMetadata(stored.id, fields)
      return { ...stored, ...fields, verified: true, app: null }
    }
    const created = await this.oauthClientRepository.createClient({
      clientId,
      registrationType: "cimd",
      ...fields,
    })
    return { ...created, verified: true, app: null }
  }

  /** An app client takes its name and redirect URIs from its manifest, which may change. */
  private async resolveAppClient(clientId: string): Promise<ResolvedOAuthClient | null> {
    const client = await this.oauthClientRepository.findByClientId(clientId)
    if (client?.registrationType !== "app" || !client.appManifestId) return null
    const app = await this.appManifestRepository.findById(client.appManifestId)
    if (!app) return null
    return {
      ...client,
      clientName: app.name,
      redirectUris: app.allowedRedirectUris,
      verified: true,
      app,
    }
  }

  /**
   * Registration is the only way to add rows without signing in, so it is
   * where stale ones go: unused dcr clients, expired codes and refresh tokens.
   * The rate limit of registration bounds how often this runs.
   */
  private async deleteStaleRows(): Promise<void> {
    const now = new Date()
    const deletedClients = await this.oauthClientRepository.deleteUnusedDcrClientsCreatedBefore(
      new Date(now.getTime() - UNUSED_DCR_CLIENT_TTL_MS),
    )
    await this.oauthClientRepository.deleteExpiredCodesAndRefreshTokens(now)
    if (deletedClients > 0) this.logger.log(`Deleted ${deletedClients} unused dcr client(s)`)
  }

  private async fetchClientMetadataDocument(
    url: URL,
  ): Promise<z.infer<typeof clientMetadataDocumentSchema> | null> {
    try {
      const parsed = clientMetadataDocumentSchema.safeParse(
        await this.clientMetadataDocumentFetcher.fetchDocument(url),
      )
      // The document must name itself: a copy hosted elsewhere is not the client.
      if (!parsed.success || parsed.data.client_id !== url.toString()) return null
      return parsed.data
    } catch (error) {
      if (error instanceof ClientMetadataDocumentError) {
        this.logger.warn(`Client metadata document ${url.host}: ${error.message}`)
        return null
      }
      throw error
    }
  }
}

function dummySecretHash(): Promise<string> {
  dummyClientSecretHash ??= hashClientSecret("timing-safe-dummy")
  return dummyClientSecretHash
}
