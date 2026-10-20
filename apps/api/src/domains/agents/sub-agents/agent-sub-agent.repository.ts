import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentSubAgent } from "./agent-sub-agent.entity"

@Injectable()
export class AgentSubAgentRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Gives `toParentAgentId` the sub-agents of `fromParentAgentId`, with the same tool name,
   * description, mode and state. A sub-agent whose agent was deleted is left out.
   */
  async copySubAgents({
    fromParentAgentId,
    toParentAgentId,
  }: {
    fromParentAgentId: string
    toParentAgentId: string
  }): Promise<number> {
    const subAgents = await this.repo().find({
      where: { parentAgentId: fromParentAgentId },
      relations: { childAgent: true },
      order: { createdAt: "ASC" },
    })
    const copies = subAgents
      .filter((subAgent) => subAgent.childAgent && subAgent.childAgent.deletedAt === null)
      .map((subAgent) =>
        this.repo().create({
          parentAgentId: toParentAgentId,
          childAgentId: subAgent.childAgentId,
          toolName: subAgent.toolName,
          description: subAgent.description,
          enabled: subAgent.enabled,
          mode: subAgent.mode,
        }),
      )
    if (copies.length > 0) await this.repo().save(copies)
    return copies.length
  }

  private repo(): Repository<AgentSubAgent> {
    return this.transactionService.getManager().getRepository(AgentSubAgent)
  }
}
