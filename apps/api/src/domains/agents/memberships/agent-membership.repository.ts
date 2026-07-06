import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { In } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import { AgentMembership, type AgentMembershipRole } from "./agent-membership.entity"
import type { AgentMembershipModel } from "./agent-membership.model"

/**
 * Repository for agent memberships.
 *
 * Reads from the legacy `agent_membership` table. Writes to both the legacy
 * table and the unified `user_membership` table (dual-write transition).
 *
 * All write methods participate in whatever transaction is active in the
 * current async context (via TransactionService.getManager()). The service
 * layer is responsible for starting transactions using TransactionService.run().
 */
@Injectable()
export class AgentMembershipRepository {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findById({
    membershipId,
    agentId,
  }: {
    membershipId: string
    agentId?: string
  }): Promise<AgentMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { id: membershipId, agentId },
      relations: ["user", "agent"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAllByAgent(agentId: string): Promise<AgentMembershipModel[]> {
    const entities = await this.repo().find({
      where: { agentId },
      relations: ["user", "agent"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByUser(userId: string): Promise<AgentMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId },
      relations: ["user", "agent"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findByUserAndAgent({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<AgentMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { userId, agentId },
      relations: ["user", "agent"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findByUserAndAgents({
    userId,
    agentIds,
  }: {
    userId: string
    agentIds: string[]
  }): Promise<AgentMembershipModel[]> {
    if (agentIds.length === 0) return []

    const entities = await this.repo().find({
      where: { userId, agentId: In(agentIds) },
      relations: ["user", "agent"],
    })
    return entities.map((entity) => this.toModel(entity))
  }

  /**
   * Creates a membership, writing to both the legacy and unified tables.
   * Must be called from within a TransactionService.run() context.
   */
  async createMembership({
    userId,
    agentId,
    role,
  }: {
    userId: string
    agentId: string
    role: AgentMembershipRole
  }): Promise<AgentMembershipModel> {
    const membershipRepo = this.repo()
    const entity = membershipRepo.create({ userId, agentId, role })
    const saved = await membershipRepo.save(entity)
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "agent",
      resourceId: agentId,
      role,
    })
    const withRelations = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user", "agent"],
    })
    return this.toModel(withRelations)
  }

  /**
   * Updates the role of an existing membership, writing to both tables.
   * Must be called from within a TransactionService.run() context.
   */
  async updateRole({
    membershipId,
    userId,
    agentId,
    role,
  }: {
    membershipId: string
    userId: string
    agentId: string
    role: AgentMembershipRole
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.update({ id: membershipId, agentId }, { role })
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "agent",
      resourceId: agentId,
      role,
    })
  }

  /**
   * Deletes a membership from both tables.
   * Must be called from within a TransactionService.run() context.
   */
  async deleteMembership({
    membershipId,
    agentId,
    userId,
  }: {
    membershipId: string
    agentId: string
    userId: string
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.delete({ id: membershipId, agentId })
    await this.userMembershipRepository.deleteMembership({
      userId,
      resourceType: "agent",
      resourceId: agentId,
    })
  }

  /**
   * Deletes all agent memberships for a user across the given agents.
   * Must be called from within a TransactionService.run() context.
   */
  async deleteMembershipsForUserAndAgents({
    userId,
    agentIds,
  }: {
    userId: string
    agentIds: string[]
  }): Promise<void> {
    if (agentIds.length === 0) return

    const membershipRepo = this.repo()
    await membershipRepo.delete({ agentId: In(agentIds), userId })
    await this.userMembershipRepository.deleteMembershipsForUser({
      userId,
      resourceType: "agent",
      resourceIds: agentIds,
    })
  }

  private repo(): Repository<AgentMembership> {
    return this.transactionService.getManager().getRepository(AgentMembership)
  }

  private toModel(entity: AgentMembership): AgentMembershipModel {
    return {
      id: entity.id,
      userId: entity.userId,
      agentId: entity.agentId,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      user: entity.user,
      agent: entity.agent,
    }
  }
}
