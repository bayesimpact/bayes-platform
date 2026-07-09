import type { AgentType } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Agent } from "./agent.entity"

export type AgentSummary = {
  id: string
  name: string
  type: AgentType
}

@Injectable()
export class AgentRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findSummariesByProject(projectId: string): Promise<AgentSummary[]> {
    return this.repo().find({
      where: { projectId },
      select: { id: true, name: true, type: true },
      order: { createdAt: "ASC" },
    })
  }

  async findIdsByProject(projectId: string): Promise<string[]> {
    const agents = await this.repo().find({
      where: { projectId },
      select: { id: true },
    })
    return agents.map((agent) => agent.id)
  }

  async softDelete(agentId: string): Promise<void> {
    const entityManager = this.transactionService.getManager()

    for (const entity of ALL_ENTITIES) {
      const hasAgentId = entityManager.connection
        .getMetadata(entity)
        .columns.some((column) => column.propertyName === "agentId")
      if (hasAgentId) {
        await entityManager.softDelete(entity, { agentId })
      }
    }

    await entityManager.softDelete(Agent, { id: agentId })
  }

  private repo(): Repository<Agent> {
    return this.transactionService.getManager().getRepository(Agent)
  }
}
