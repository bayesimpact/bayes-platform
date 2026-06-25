import type { ReplaceAgentSubAgentDto } from "@caseai-connect/api-contracts"
import { Injectable, UnprocessableEntityException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "../agent.entity"
import { AgentSubAgent } from "./agent-sub-agent.entity"

@Injectable()
export class AgentSubAgentsService {
  constructor(
    @InjectRepository(AgentSubAgent)
    private readonly agentSubAgentRepository: Repository<AgentSubAgent>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listSubAgents({
    connectScope,
    parentAgent,
  }: {
    connectScope: RequiredConnectScope
    parentAgent: Agent
  }): Promise<AgentSubAgent[]> {
    this.validateParentAgent({ connectScope, parentAgent })

    return this.agentSubAgentRepository.find({
      where: { parentAgentId: parentAgent.id },
      relations: {
        childAgent: {
          sessionCategories: true,
          documentTags: true,
        },
      },
      order: { createdAt: "ASC" },
    })
  }

  async replaceSubAgents({
    connectScope,
    parentAgent,
    subAgents,
  }: {
    connectScope: RequiredConnectScope
    parentAgent: Agent
    subAgents: ReplaceAgentSubAgentDto[]
  }): Promise<AgentSubAgent[]> {
    this.validateParentAgent({ connectScope, parentAgent })
    this.validateReplacementInput({ parentAgent, subAgents })

    const childAgents = await this.resolveChildAgents({
      connectScope,
      childAgentIds: subAgents.map((subAgent) => subAgent.childAgentId),
    })
    const childAgentById = new Map(childAgents.map((agent) => [agent.id, agent]))

    await this.dataSource.transaction(async (entityManager) => {
      await entityManager.delete(AgentSubAgent, { parentAgentId: parentAgent.id })

      if (subAgents.length === 0) {
        return
      }

      const rows = subAgents.map((subAgent) =>
        entityManager.create(AgentSubAgent, {
          parentAgentId: parentAgent.id,
          childAgentId: subAgent.childAgentId,
          toolName: subAgent.toolName,
          description: subAgent.description,
          enabled: subAgent.enabled,
        }),
      )
      await entityManager.save(AgentSubAgent, rows)
    })

    const savedRows = await this.listSubAgents({ connectScope, parentAgent })
    for (const row of savedRows) {
      row.childAgent = childAgentById.get(row.childAgentId) ?? row.childAgent
    }
    return savedRows
  }

  private validateParentAgent({
    connectScope,
    parentAgent,
  }: {
    connectScope: RequiredConnectScope
    parentAgent: Agent
  }) {
    if (
      parentAgent.organizationId !== connectScope.organizationId ||
      parentAgent.projectId !== connectScope.projectId
    ) {
      throw new UnprocessableEntityException("Parent agent must belong to the current project")
    }

    if (parentAgent.type !== "conversation") {
      throw new UnprocessableEntityException("Only conversation agents can have sub-agents")
    }
  }

  private validateReplacementInput({
    parentAgent,
    subAgents,
  }: {
    parentAgent: Agent
    subAgents: ReplaceAgentSubAgentDto[]
  }) {
    const childAgentIds = subAgents.map((subAgent) => subAgent.childAgentId)
    if (childAgentIds.includes(parentAgent.id)) {
      throw new UnprocessableEntityException("An agent cannot be its own sub-agent")
    }

    if (new Set(childAgentIds).size !== childAgentIds.length) {
      throw new UnprocessableEntityException("Duplicate sub-agents are not allowed")
    }

    const toolNames = subAgents.map((subAgent) => subAgent.toolName)
    if (new Set(toolNames).size !== toolNames.length) {
      throw new UnprocessableEntityException("Duplicate sub-agent tool names are not allowed")
    }
  }

  private async resolveChildAgents({
    connectScope,
    childAgentIds,
  }: {
    connectScope: RequiredConnectScope
    childAgentIds: string[]
  }): Promise<Agent[]> {
    if (childAgentIds.length === 0) {
      return []
    }

    const childAgents = await this.agentRepository.find({
      where: {
        id: In(childAgentIds),
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })

    if (childAgents.length !== childAgentIds.length) {
      throw new UnprocessableEntityException("One or more sub-agents do not exist in this project")
    }

    return childAgents
  }
}
