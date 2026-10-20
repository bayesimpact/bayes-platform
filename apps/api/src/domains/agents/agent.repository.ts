import type { AgentType } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { Repository, SelectQueryBuilder } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Agent } from "./agent.entity"

export type AgentSummary = {
  id: string
  name: string
  type: AgentType
}

/** What a copy takes from an agent besides its settings: its type, document tags and libraries. */
export type AgentDuplicationSource = AgentSummary & {
  documentTagIds: string[]
  resourceLibraryIds: string[]
}

export type CreateAgentFields = {
  name: string
  type: AgentType
  documentTagIds: string[]
  resourceLibraryIds: string[]
}

@Injectable()
export class AgentRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** The agent of the project with the document tags and libraries a copy takes over, or null. */
  async findDuplicationSource(
    connectScope: RequiredConnectScope,
    agentId: string,
  ): Promise<AgentDuplicationSource | null> {
    const [agent] = await this.connectRepo().find(connectScope, {
      where: { id: agentId },
      relations: { documentTags: true, resourceLibraries: true },
    })
    if (!agent) return null
    return {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      documentTagIds: agent.documentTags
        .filter((documentTag) => documentTag.deletedAt === null)
        .map((documentTag) => documentTag.id),
      resourceLibraryIds: agent.resourceLibraries
        .filter((resourceLibrary) => resourceLibrary.deletedAt === null)
        .map((resourceLibrary) => resourceLibrary.id),
    }
  }

  /** A new agent of the project, linked to document tags and resource libraries of that project. */
  async createAgent(connectScope: RequiredConnectScope, fields: CreateAgentFields): Promise<Agent> {
    return this.connectRepo().createAndSave(connectScope, {
      name: fields.name,
      type: fields.type,
      documentTags: fields.documentTagIds.map((documentTagId) => ({ id: documentTagId })),
      resourceLibraries: fields.resourceLibraryIds.map((resourceLibraryId) => ({
        id: resourceLibraryId,
      })),
    })
  }

  async findSummariesByProject(projectId: string): Promise<AgentSummary[]> {
    return this.repo().find({
      where: { projectId },
      select: { id: true, name: true, type: true },
      order: { createdAt: "ASC" },
    })
  }

  /**
   * Published conversation agents of the project among `agentIds`, in creation order. An agent
   * that was never published, such as a fresh copy, is left out.
   */
  async findConversationSummariesByIds(
    projectId: string,
    agentIds: readonly string[],
  ): Promise<AgentSummary[]> {
    if (agentIds.length === 0) return []
    return this.publishedConversationAgents(projectId)
      .andWhere("agent.id IN (:...agentIds)", { agentIds: [...agentIds] })
      .orderBy("agent.createdAt", "ASC")
      .getMany()
  }

  /** The published conversation agent with this id in the project, or null. */
  async findConversationSummaryInProject(
    projectId: string,
    agentId: string,
  ): Promise<AgentSummary | null> {
    return this.publishedConversationAgents(projectId)
      .andWhere("agent.id = :agentId", { agentId })
      .getOne()
  }

  /** The organization and project of a live agent, or null when it does not exist. */
  async findScopeById(
    agentId: string,
  ): Promise<{ organizationId: string; projectId: string } | null> {
    const agent = await this.repo().findOne({
      where: { id: agentId },
      select: { id: true, organizationId: true, projectId: true },
    })
    return agent ? { organizationId: agent.organizationId, projectId: agent.projectId } : null
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

  /** Conversation agents of the project with a published revision, as id, name and type. */
  private publishedConversationAgents(projectId: string): SelectQueryBuilder<Agent> {
    return this.repo()
      .createQueryBuilder("agent")
      .select(["agent.id", "agent.name", "agent.type"])
      .where("agent.projectId = :projectId", { projectId })
      .andWhere("agent.type = :type", { type: "conversation" })
      .andWhere(
        `EXISTS (SELECT 1 FROM agent_settings published
          WHERE published.agent_id = agent.id
            AND published.is_draft = false
            AND published.is_archived = false
            AND published.deleted_at IS NULL)`,
      )
  }

  private connectRepo(): ConnectRepository<Agent> {
    return new ConnectRepository(this.repo(), "agents")
  }
}
