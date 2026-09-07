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

export type McpServerConfig = {
  url: string
  apiKey?: string
  /**
   * Static headers sent on every call to this server, for whatever a given
   * server expects beyond its auth (an API version, a tenant). Stored in the
   * encrypted config blob, so adding them needs no migration. The conversation
   * context is applied after them and cannot be overridden here.
   */
  headers?: Record<string, string>
}

export type EnabledMcpServer = McpServerConfig & {
  id: string
  /**
   * Set for built-in servers behind Google IAM (Cloud Run invoker): the client
   * mints an ID token for this audience instead of sending a static API key.
   */
  googleIamAudience?: string
}

@Injectable()
export class McpServersService {
  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    @InjectRepository(AgentMcpServer)
    private readonly agentMcpServerRepository: Repository<AgentMcpServer>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async getEnabledServersForAgent(agentId: string): Promise<EnabledMcpServer[]> {
    const agentMcpServers = await this.agentMcpServerRepository.find({
      where: { agentId, enabled: true },
      relations: ["mcpServer"],
    })

    return agentMcpServers
      .filter((agentMcpServer) => agentMcpServer.mcpServer)
      .map((agentMcpServer) =>
        this.toEnabledServer(
          agentMcpServer.mcpServer,
          this.decryptConfig(agentMcpServer.mcpServer),
        ),
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

  decryptUrl(mcpServer: McpServer): string {
    return this.decryptConfig(mcpServer).url
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
