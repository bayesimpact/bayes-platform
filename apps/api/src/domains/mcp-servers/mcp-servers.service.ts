import type {
  McpServerAuthMethod,
  McpServerAuthStatus,
  McpServerInspectionDto,
  UpdateMcpServerDto,
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
import { InjectRepository } from "@nestjs/typeorm"
import { In, IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EncryptionService } from "@/common/encryption/encryption.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { isGoogleIamAuthEnabled } from "@/external/google-iam"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { AgentMcpServer } from "./agent-mcp-server.entity"
import {
  BUILT_IN_PRESET_SLUGS,
  isBuiltInMcpServer,
  PDF_EXPORT_PRESET_SLUG,
} from "./built-in/built-in-mcp-servers"
import { McpServer } from "./mcp-server.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServerRepository } from "./mcp-server.repository"
import type { EnabledMcpServer, McpServerConfig } from "./mcp-server-config.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpOauthService } from "./oauth/mcp-oauth.service"
import { canStillAuthenticate } from "./oauth/oauth-tokens"
import {
  assertAllowedOutboundUrl,
  DisallowedOutboundUrlError,
  isInsecureLocalUrl,
} from "./oauth/outbound-url-guard"

export type {
  EnabledMcpServer,
  McpServerConfig,
  McpServerOauthPendingAuth,
  McpServerOauthState,
  McpServerOauthTokens,
} from "./mcp-server-config.types"

/** A built-in or operator-seeded server: it belongs to no project, so no project member set its URL. */
function isConfiguredByPlatform(mcpServer: McpServer): boolean {
  return mcpServer.projectId === null
}

@Injectable()
export class McpServersService {
  private readonly logger = new Logger(McpServersService.name)

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    @InjectRepository(AgentMcpServer)
    private readonly agentMcpServerRepository: Repository<AgentMcpServer>,
    private readonly encryptionService: EncryptionService,
    private readonly mcpOauthService: McpOauthService,
    private readonly configService: ConfigService,
    private readonly mcpServerCustomRepository: McpServerRepository,
    private readonly transactionService: TransactionService,
    private readonly mcpClientService: McpClientService,
  ) {}

  async getEnabledServersForAgent(agentId: string): Promise<EnabledMcpServer[]> {
    const agentMcpServers = await this.agentMcpServerRepository.find({
      where: { agentId, enabled: true },
      relations: ["mcpServer"],
    })

    const enabledServers = agentMcpServers.filter((agentMcpServer) => agentMcpServer.mcpServer)
    const servers = await Promise.all(
      enabledServers.map((agentMcpServer) =>
        this.toEnabledServerIfUsable(agentMcpServer.mcpServer),
      ),
    )
    return servers.filter((server) => server !== null)
  }

  /**
   * An OAuth server with no usable access token (never authorized, or tokens
   * dropped after a definitive refresh failure) is left out rather than dialed
   * unauthenticated, which would only produce a 401 on every turn.
   */
  private async toEnabledServerIfUsable(mcpServer: McpServer): Promise<EnabledMcpServer | null> {
    const { oauth, ...config } = this.decryptConfig(mcpServer)
    const disallowedUrlReason = await this.findDisallowedUrlReason(mcpServer, config.url)
    if (disallowedUrlReason) {
      this.logger.warn(
        `Skipping MCP server "${mcpServer.name}" (${mcpServer.id}): ${disallowedUrlReason}`,
      )
      return null
    }
    const usesOauth = oauth !== undefined || config.authMethod === "oauth"
    if (!usesOauth) return this.toEnabledServer(mcpServer, config)

    const accessToken = oauth
      ? await this.mcpOauthService.getValidAccessToken(mcpServer.id, oauth)
      : null
    if (!accessToken) {
      this.logger.warn(
        `Skipping MCP server "${mcpServer.name}" (${mcpServer.id}): OAuth authorization is missing or expired`,
      )
      return null
    }
    return this.toEnabledServer(mcpServer, { ...config, apiKey: accessToken })
  }

  async createPreset(slug: string, name: string, config: McpServerConfig): Promise<McpServer> {
    const encryptedConfig = this.encryptionService.encrypt(JSON.stringify(config))
    return this.mcpServerRepository.save(
      this.mcpServerRepository.create({
        name,
        presetSlug: slug,
        projectId: null,
        encryptedConfig,
      }),
    )
  }

  async createMcpServer({
    projectId,
    name,
    config,
  }: {
    projectId: string
    name: string
    config: McpServerConfig
  }): Promise<McpServer> {
    const encryptedConfig = this.encryptionService.encrypt(JSON.stringify(config))
    return this.mcpServerRepository.save(
      this.mcpServerRepository.create({
        name,
        presetSlug: null,
        projectId,
        encryptedConfig,
      }),
    )
  }

  /** The project's own servers plus the built-in ones, which belong to none. */
  async listMcpServers(projectId: string): Promise<McpServer[]> {
    const mcpServers = await this.mcpServerRepository.find({
      where: [{ projectId }, { projectId: IsNull(), presetSlug: In(BUILT_IN_PRESET_SLUGS) }],
    })
    return mcpServers.sort((first, second) => {
      if (isBuiltInMcpServer(first) !== isBuiltInMcpServer(second)) {
        return isBuiltInMcpServer(first) ? -1 : 1
      }
      return first.name.localeCompare(second.name)
    })
  }

  async findMcpServerById(mcpServerId: string, projectId: string): Promise<McpServer | null> {
    return this.mcpServerRepository.findOne({
      where: [
        { id: mcpServerId, projectId },
        { id: mcpServerId, projectId: IsNull(), presetSlug: In(BUILT_IN_PRESET_SLUGS) },
      ],
    })
  }

  /**
   * Applies an edit to a server in place, so the agents it is enabled on keep
   * it. Secrets are write-only: an empty key and a `null` header value keep
   * what is stored.
   */
  async updateMcpServer(mcpServerId: string, fields: UpdateMcpServerDto): Promise<McpServer> {
    return this.transactionService.run(async () => {
      const mcpServer = await this.mcpServerCustomRepository.findByIdForUpdate(mcpServerId)
      if (!mcpServer) throw new NotFoundException()
      if (isBuiltInMcpServer(mcpServer)) {
        throw new ForbiddenException("Built-in MCP servers cannot be edited")
      }
      const config = this.applyConfigUpdate(this.decryptConfig(mcpServer), fields)
      return this.mcpServerCustomRepository.updateNameAndConfig(mcpServerId, {
        name: fields.name ?? mcpServer.name,
        encryptedConfig: this.encryptionService.encrypt(JSON.stringify(config)),
      })
    })
  }

  private applyConfigUpdate(stored: McpServerConfig, fields: UpdateMcpServerDto): McpServerConfig {
    const storedAuthMethod = this.getAuthMethod(stored)
    const url = fields.url ?? stored.url
    const authMethod = fields.authMethod ?? storedAuthMethod

    const newApiKey = fields.apiKey?.trim() ? fields.apiKey : undefined
    // A stored key only survives while the method stays apiKey: for an OAuth
    // server the same field would be read as a key at the next method switch.
    const keptApiKey = storedAuthMethod === "apiKey" ? stored.apiKey : undefined
    const apiKey = authMethod === "apiKey" ? (newApiKey ?? keptApiKey) : undefined
    if (authMethod === "apiKey" && !apiKey) {
      throw new BadRequestException(
        "An API key is required when the authentication method is API key.",
      )
    }

    // The OAuth client, endpoints and tokens were all discovered from the URL:
    // none of them is valid for another one.
    const keepsOauthState = authMethod === "oauth" && url === stored.url
    return {
      url,
      authMethod,
      apiKey,
      headers: this.mergeHeaders(stored.headers, fields.headers),
      oauth: keepsOauthState ? stored.oauth : undefined,
    }
  }

  private mergeHeaders(
    stored: Record<string, string> | undefined,
    updated: UpdateMcpServerDto["headers"],
  ): Record<string, string> | undefined {
    if (updated === undefined) return stored
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(updated)) {
      const kept = value ?? stored?.[name]
      if (kept === undefined) {
        throw new BadRequestException(`Header "${name}" has no stored value to keep.`)
      }
      headers[name] = kept
    }
    return Object.keys(headers).length > 0 ? headers : undefined
  }

  /**
   * Connects to the server now and reports whether it answers and with which
   * tools. Nothing is stored: the answer is only true at the time of the call.
   */
  async inspectMcpServer(mcpServer: McpServer): Promise<McpServerInspectionDto> {
    const checkedAt = Date.now()
    const { oauth, ...config } = this.decryptConfig(mcpServer)

    const disallowedUrlReason = await this.findDisallowedUrlReason(mcpServer, config.url)
    if (disallowedUrlReason) {
      return {
        status: "failed",
        tools: [],
        error: { code: "urlNotAllowed", httpStatus: null, detail: disallowedUrlReason },
        checkedAt,
      }
    }

    const usesOauth = oauth !== undefined || config.authMethod === "oauth"
    let apiKey = config.apiKey
    if (usesOauth) {
      const accessToken = oauth
        ? await this.mcpOauthService.getValidAccessToken(mcpServer.id, oauth)
        : null
      if (!accessToken) {
        return { status: "authorizationRequired", tools: [], error: null, checkedAt }
      }
      apiKey = accessToken
    }

    const inspection = await this.mcpClientService.inspect(
      this.toEnabledServer(mcpServer, { ...config, apiKey }),
    )
    if (inspection.isConnected) {
      return { status: "connected", tools: inspection.tools, error: null, checkedAt }
    }
    return { status: "failed", tools: [], error: inspection.error, checkedAt }
  }

  async deleteMcpServer(mcpServerId: string): Promise<void> {
    const mcpServer = await this.mcpServerRepository.findOne({ where: { id: mcpServerId } })
    if (mcpServer && isBuiltInMcpServer(mcpServer)) {
      throw new ForbiddenException("Built-in MCP servers cannot be deleted")
    }
    await this.agentMcpServerRepository.softDelete({ mcpServerId })
    await this.mcpServerRepository.softDelete({ id: mcpServerId })
  }

  async enableForAgent(agentId: string, mcpServerId: string): Promise<AgentMcpServer> {
    const existing = await this.agentMcpServerRepository.findOne({
      where: { agentId, mcpServerId },
    })
    if (existing) {
      if (existing.enabled) return existing
      existing.enabled = true
      return this.agentMcpServerRepository.save(existing)
    }
    return this.agentMcpServerRepository.save(
      this.agentMcpServerRepository.create({
        agentId,
        mcpServerId,
        enabled: true,
      }),
    )
  }

  async disableForAgent(agentId: string, mcpServerId: string): Promise<void> {
    await this.agentMcpServerRepository.delete({ agentId, mcpServerId })
  }

  getConfig(mcpServer: McpServer): McpServerConfig {
    return this.decryptConfig(mcpServer)
  }

  /** Servers created before `authMethod` was stored carry none: it is read from what they hold. */
  getAuthMethod(config: McpServerConfig): McpServerAuthMethod {
    if (config.authMethod) return config.authMethod
    if (config.oauth) return "oauth"
    return config.apiKey ? "apiKey" : "none"
  }

  getAuthStatus(config: McpServerConfig): McpServerAuthStatus {
    if (canStillAuthenticate(config.oauth?.tokens)) return "oauthConnected"
    // Authorized once, and the tokens are gone or dead: not the same thing to
    // tell someone as "never authorized".
    if (config.oauth?.authorizedAt !== undefined) return "oauthExpired"
    if (config.oauth || config.authMethod === "oauth") return "oauthPending"
    if (config.apiKey) return "apiKey"
    return "none"
  }

  /**
   * The built-in PDF export server runs on Cloud Run behind invoker IAM in
   * production: its audience is the service root URL, and the MCP client mints
   * an ID token for it. Custom servers keep their own configured auth.
   */
  private toEnabledServer(mcpServer: McpServer, config: McpServerConfig): EnabledMcpServer {
    const usesGoogleIam =
      mcpServer.presetSlug === PDF_EXPORT_PRESET_SLUG &&
      isGoogleIamAuthEnabled(this.configService.get<string>("PDF_CONVERTER_AUTH"))
    return {
      id: mcpServer.id,
      ...config,
      ...(isConfiguredByPlatform(mcpServer) ? { followRedirects: true } : {}),
      ...(this.isOnPublicAddress(mcpServer, config.url) ? { publicAddressesOnly: true } : {}),
      ...(usesGoogleIam ? { googleIamAudience: new URL(config.url).origin } : {}),
    }
  }

  /**
   * A server a project configured is called from the platform's own network,
   * so its URL must be public https whatever its authentication method. The
   * servers of no project are configured by the platform and run inside it.
   */
  private async findDisallowedUrlReason(mcpServer: McpServer, url: string): Promise<string | null> {
    if (isConfiguredByPlatform(mcpServer)) return null
    if (this.isAllowedInternalHost(url)) return null
    try {
      await assertAllowedOutboundUrl(url)
      return null
    } catch (error) {
      if (!(error instanceof DisallowedOutboundUrlError)) throw error
      return error.message
    }
  }

  /**
   * A server a project configured, at neither an internal host the platform
   * allows nor localhost in local development, must stay on public addresses:
   * each connection checks the address again.
   */
  private isOnPublicAddress(mcpServer: McpServer, url: string): boolean {
    return (
      !isConfiguredByPlatform(mcpServer) &&
      !this.isAllowedInternalHost(url) &&
      !isInsecureLocalUrl(url)
    )
  }

  /**
   * An internal MCP service the operator deploys beside the platform (a
   * Kubernetes service, for example) is listed by host name in
   * MCP_ALLOWED_INTERNAL_HOSTS. The deployment sets the list, never a project.
   */
  private isAllowedInternalHost(url: string): boolean {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return false
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    const allowedHosts = (this.configService.get<string>("MCP_ALLOWED_INTERNAL_HOSTS") ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0)
    return allowedHosts.includes(parsed.hostname.toLowerCase())
  }

  private decryptConfig(mcpServer: McpServer): McpServerConfig {
    const decrypted = this.encryptionService.decrypt(mcpServer.encryptedConfig)
    return JSON.parse(decrypted) as McpServerConfig
  }
}
