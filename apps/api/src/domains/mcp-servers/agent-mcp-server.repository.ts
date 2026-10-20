import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentMcpServer } from "./agent-mcp-server.entity"

@Injectable()
export class AgentMcpServerRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Gives `toAgentId` the MCP servers of `fromAgentId`, each on or off as it is there. A server
   * that was deleted is left out.
   */
  async copyAgentServers({
    fromAgentId,
    toAgentId,
  }: {
    fromAgentId: string
    toAgentId: string
  }): Promise<number> {
    const agentMcpServers = await this.repo().find({
      where: { agentId: fromAgentId },
      relations: { mcpServer: true },
    })
    const copies = agentMcpServers
      .filter(
        (agentMcpServer) => agentMcpServer.mcpServer && agentMcpServer.mcpServer.deletedAt === null,
      )
      .map((agentMcpServer) =>
        this.repo().create({
          agentId: toAgentId,
          mcpServerId: agentMcpServer.mcpServerId,
          enabled: agentMcpServer.enabled,
        }),
      )
    if (copies.length > 0) await this.repo().save(copies)
    return copies.length
  }

  private repo(): Repository<AgentMcpServer> {
    return this.transactionService.getManager().getRepository(AgentMcpServer)
  }
}
