import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Agent } from "@/domains/agents/agent.entity"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { AgentMembershipModel } from "./agent-membership.model"
import type { AgentMembershipRole } from "./agent-membership.types"

const AGENT_RESOURCE_TYPE = "agent" as const

/**
 * Repository for agent memberships.
 *
 * Reads and writes the unified `user_membership` table with
 * `resourceType = 'agent'`.
 */
@Injectable()
export class AgentMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findById({
    membershipId,
    agentId,
  }: {
    membershipId: string
    agentId?: string
  }): Promise<AgentMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        id: membershipId,
        resourceType: AGENT_RESOURCE_TYPE,
        ...(agentId ? { resourceId: agentId } : {}),
      },
      relations: ["user"],
    })
    if (!membership) return null

    const agent = await this.agentRepo().findOne({ where: { id: membership.resourceId } })
    if (!agent) return null

    return this.toModel(membership, agent)
  }

  async findAllByAgent(agentId: string): Promise<AgentMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { resourceType: AGENT_RESOURCE_TYPE, resourceId: agentId },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    const agent = await this.agentRepo().findOneOrFail({ where: { id: agentId } })
    return memberships.map((membership) => this.toModel(membership, agent))
  }

  async findAllByUser(userId: string): Promise<AgentMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: AGENT_RESOURCE_TYPE },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAdminAndOwnerByUser(userId: string): Promise<AgentMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: [
        { userId, resourceType: AGENT_RESOURCE_TYPE, role: "admin" },
        { userId, resourceType: AGENT_RESOURCE_TYPE, role: "owner" },
      ],
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findAllByAgentIds(agentIds: string[]): Promise<AgentMembershipModel[]> {
    if (agentIds.length === 0) return []

    const memberships = await this.userMembershipRepo().find({
      where: { resourceType: AGENT_RESOURCE_TYPE, resourceId: In(agentIds) },
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findByUserAndAgent({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<AgentMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        userId,
        resourceType: AGENT_RESOURCE_TYPE,
        resourceId: agentId,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const agent = await this.agentRepo().findOne({ where: { id: agentId } })
    if (!agent) return null

    return this.toModel(membership, agent)
  }

  async findByUserAndAgents({
    userId,
    agentIds,
  }: {
    userId: string
    agentIds: string[]
  }): Promise<AgentMembershipModel[]> {
    if (agentIds.length === 0) return []

    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: AGENT_RESOURCE_TYPE, resourceId: In(agentIds) },
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async createMembership({
    userId,
    agentId,
    role,
  }: {
    userId: string
    agentId: string
    role: AgentMembershipRole
  }): Promise<AgentMembershipModel> {
    const saved = await this.userMembershipRepo().save(
      this.userMembershipRepo().create({
        userId,
        resourceType: AGENT_RESOURCE_TYPE,
        resourceId: agentId,
        role,
      }),
    )
    const withUser = await this.userMembershipRepo().findOneOrFail({
      where: { id: saved.id },
      relations: ["user"],
    })
    const agent = await this.agentRepo().findOneOrFail({ where: { id: agentId } })
    return this.toModel(withUser, agent)
  }

  async updateRole({
    membershipId,
    agentId,
    role,
  }: {
    membershipId: string
    userId: string
    agentId: string
    role: AgentMembershipRole
  }): Promise<void> {
    await this.userMembershipRepo().update(
      {
        id: membershipId,
        resourceType: AGENT_RESOURCE_TYPE,
        resourceId: agentId,
      },
      { role },
    )
  }

  async deleteMembership({
    membershipId,
    agentId,
    userId,
  }: {
    membershipId: string
    agentId: string
    userId: string
  }): Promise<void> {
    await this.userMembershipRepo().delete({
      id: membershipId,
      userId,
      resourceType: AGENT_RESOURCE_TYPE,
      resourceId: agentId,
    })
  }

  async deleteMembershipsForUserAndAgents({
    userId,
    agentIds,
  }: {
    userId: string
    agentIds: string[]
  }): Promise<void> {
    if (agentIds.length === 0) return

    await this.userMembershipRepo()
      .createQueryBuilder()
      .delete()
      .where(
        '"user_id" = :userId AND "resource_type" = :resourceType AND "resource_id" = ANY(:agentIds)',
        { userId, resourceType: AGENT_RESOURCE_TYPE, agentIds },
      )
      .execute()
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private agentRepo(): Repository<Agent> {
    return this.transactionService.getManager().getRepository(Agent)
  }

  private async toModels(memberships: UserMembership[]): Promise<AgentMembershipModel[]> {
    if (memberships.length === 0) return []

    const agentIds = [...new Set(memberships.map((membership) => membership.resourceId))]
    const agents = await this.agentRepo().find({ where: { id: In(agentIds) } })
    const agentById = new Map(agents.map((agent) => [agent.id, agent]))

    return memberships.flatMap((membership) => {
      const agent = agentById.get(membership.resourceId)
      return agent ? [this.toModel(membership, agent)] : []
    })
  }

  private toModel(membership: UserMembership, agent: Agent): AgentMembershipModel {
    return {
      id: membership.id,
      userId: membership.userId,
      agentId: membership.resourceId,
      role: membership.role as AgentMembershipRole,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
      user: membership.user,
      agent,
    }
  }
}
