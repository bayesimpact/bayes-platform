import type { McpServerAuthStatus } from "@caseai-connect/api-contracts"
import { ForbiddenException, Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import { In, IsNull, type Repository } from "typeorm"
import { isGoogleIamAuthEnabled } from "@/external/google-iam"
import { AgentMcpServer } from "./agent-mcp-server.entity"
import {
  BUILT_IN_PRESET_SLUGS,
  isBuiltInMcpServer,
  PDF_EXPORT_PRESET_SLUG,
} from "./built-in/built-in-mcp-servers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EncryptionService } from "./encryption.service"
import { McpServer } from "./mcp-server.entity"
import type { EnabledMcpServer, McpServerConfig } from "./mcp-server-config.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpOauthService } from "./oauth/mcp-oauth.service"
import { canStillAuthenticate } from "./oauth/oauth-tokens"

export type {
  EnabledMcpServer,
  McpServerConfig,
  McpServerOauthPendingAuth,
  McpServerOauthState,
  McpServerOauthTokens,
} from "./mcp-server-config.types"

@Injectable()
export class McpServersService {
  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    @InjectRepository(AgentMcpServer)
    private readonly agentMcpServerRepository: Repository<AgentMcpServer>,
    private readonly encryptionService: EncryptionService,
    private readonly mcpOauthService: McpOauthService,
    private readonly configService: ConfigService,
  ) {}

  async getEnabledServersForAgent(agentId: string): Promise<EnabledMcpServer[]> {
    const agentMcpServers = await this.agentMcpServerRepository.find({
      where: { agentId, enabled: true },
      relations: ["mcpServer"],
    })

    const enabledServers = agentMcpServers.filter((agentMcpServer) => agentMcpServer.mcpServer)
    return Promise.all(
      enabledServers.map(async (agentMcpServer) => {
        const { oauth, ...config } = this.decryptConfig(agentMcpServer.mcpServer)
        if (!oauth) return this.toEnabledServer(agentMcpServer.mcpServer, config)
        const accessToken = await this.mcpOauthService.getValidAccessToken(
          agentMcpServer.mcpServer.id,
          oauth,
        )
        return this.toEnabledServer(agentMcpServer.mcpServer, {
          ...config,
          apiKey: accessToken ?? undefined,
        })
      }),
    )
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

  getAuthStatus(config: McpServerConfig): McpServerAuthStatus {
    if (canStillAuthenticate(config.oauth?.tokens)) return "oauthConnected"
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
      ...(usesGoogleIam ? { googleIamAudience: new URL(config.url).origin } : {}),
    }
  }

  private decryptConfig(mcpServer: McpServer): McpServerConfig {
    const decrypted = this.encryptionService.decrypt(mcpServer.encryptedConfig)
    return JSON.parse(decrypted) as McpServerConfig
  }
}
