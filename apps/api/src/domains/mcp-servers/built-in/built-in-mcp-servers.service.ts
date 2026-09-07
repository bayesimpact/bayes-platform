import { Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EncryptionService } from "../encryption.service"
import { McpServer } from "../mcp-server.entity"
import type { McpServerConfig } from "../mcp-servers.service"
import { PDF_EXPORT_BUILT_IN_NAME, PDF_EXPORT_PRESET_SLUG } from "./built-in-mcp-servers"

/**
 * Keeps the platform's built-in MCP server rows in sync with the environment.
 * Called once at API boot (see `main.ts`), never from a module lifecycle hook:
 * that would also fire in the workers and in every test module.
 */
@Injectable()
export class BuiltInMcpServersService {
  private readonly logger = new Logger(BuiltInMcpServersService.name)

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates the built-in row or refreshes its name and config. The upsert on
   * the preset slug also restores a row deleted by hand and tolerates
   * concurrent boots of several instances. An unchanged row is left alone, so
   * restarting the API does not bump its updated_at.
   */
  async ensureBuiltInServer({
    slug,
    name,
    config,
  }: {
    slug: string
    name: string
    config: McpServerConfig
  }): Promise<McpServer> {
    const existing = await this.mcpServerRepository.findOne({ where: { presetSlug: slug } })
    if (existing && this.matchesConfiguration(existing, { name, config })) {
      return existing
    }

    const encryptedConfig = this.encryptionService.encrypt(JSON.stringify(config))
    await this.mcpServerRepository.upsert(
      { presetSlug: slug, name, projectId: null, encryptedConfig, deletedAt: null },
      { conflictPaths: ["presetSlug"] },
    )
    return this.mcpServerRepository.findOneOrFail({ where: { presetSlug: slug } })
  }

  /** Returns the slugs that were synced and the ones the environment skips. */
  async syncFromEnvironment(): Promise<{ synced: string[]; skipped: string[] }> {
    const converterUrl = this.configService.get<string>("PDF_CONVERTER_URL")
    if (!converterUrl) {
      this.logger.log(
        `PDF_CONVERTER_URL is not set: skipping the built-in "${PDF_EXPORT_BUILT_IN_NAME}" MCP server`,
      )
      return { synced: [], skipped: [PDF_EXPORT_PRESET_SLUG] }
    }

    const url = new URL(
      "mcp",
      converterUrl.endsWith("/") ? converterUrl : `${converterUrl}/`,
    ).toString()
    await this.ensureBuiltInServer({
      slug: PDF_EXPORT_PRESET_SLUG,
      name: PDF_EXPORT_BUILT_IN_NAME,
      config: { url },
    })
    this.logger.log(`Built-in "${PDF_EXPORT_BUILT_IN_NAME}" MCP server synced at ${url}`)
    return { synced: [PDF_EXPORT_PRESET_SLUG], skipped: [] }
  }

  private matchesConfiguration(
    mcpServer: McpServer,
    { name, config }: { name: string; config: McpServerConfig },
  ): boolean {
    if (mcpServer.name !== name || mcpServer.projectId !== null) return false
    try {
      return this.encryptionService.decrypt(mcpServer.encryptedConfig) === JSON.stringify(config)
    } catch {
      // Unreadable config (a rotated key, a hand-edited row): rewrite it.
      return false
    }
  }
}
