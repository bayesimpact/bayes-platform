import type { AgentType } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
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

  /** Conversation agents of the project among `agentIds`, in creation order. */
  async findConversationSummariesByIds(
    projectId: string,
    agentIds: readonly string[],
  ): Promise<AgentSummary[]> {
    if (agentIds.length === 0) return []
    return this.repo().find({
      where: { projectId, id: In([...agentIds]), type: "conversation" },
      select: { id: true, name: true, type: true },
      order: { createdAt: "ASC" },
    })
  }

  /** The conversation agent with this id in the project, or null. */
  async findConversationSummaryInProject(
    projectId: string,
    agentId: string,
  ): Promise<AgentSummary | null> {
    return this.repo().findOne({
      where: { projectId, id: agentId, type: "conversation" },
      select: { id: true, name: true, type: true },
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
