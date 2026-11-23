import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { McpServer } from "./mcp-server.entity"

@Injectable()
export class McpServerRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * The server, with its row locked until the ambient transaction ends: its
   * config is one encrypted blob that an OAuth token refresh also rewrites, so
   * an edit must read and write it without a refresh landing in between.
   */
  async findByIdForUpdate(mcpServerId: string): Promise<McpServer | null> {
    return this.repo().findOne({
      where: { id: mcpServerId },
      lock: { mode: "pessimistic_write" },
    })
  }

  async updateNameAndConfig(
    mcpServerId: string,
    fields: { name: string; encryptedConfig: string },
  ): Promise<McpServer> {
    await this.repo().update({ id: mcpServerId }, fields)
    return this.repo().findOneByOrFail({ id: mcpServerId })
  }

  private repo(): Repository<McpServer> {
    return this.transactionService.getManager().getRepository(McpServer)
  }
}
