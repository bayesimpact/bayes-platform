import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { AgentSummary } from "@/domains/agents/agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "@/domains/agents/agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import type { AgentMembershipRole } from "./agent-membership.entity"
import type { AgentMembershipModel } from "./agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipRepository } from "./agent-membership.repository"

export const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

@Injectable()
export class AgentMembershipsService {
  constructor(
    private readonly agentMembershipRepository: AgentMembershipRepository,
    private readonly agentRepository: AgentRepository,
    private readonly projectMembershipRepository: ProjectMembershipRepository,
    private readonly transactionService: TransactionService,
    private readonly userRepository: UserRepository,
  ) {}

  async findById(membershipId: string, agentId: string): Promise<AgentMembershipModel | null> {
    return this.agentMembershipRepository.findById({ membershipId, agentId })
  }

  async listAgentMemberships(agentId: string): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAllByAgent(agentId)
  }

  async listMembershipsForUser(userId: string): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAllByUser(userId)
  }

  async listAdminAndOwnerMembershipsForUser(userId: string): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAdminAndOwnerByUser(userId)
  }

  async listMembershipsByAgentIds(agentIds: string[]): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAllByAgentIds(agentIds)
  }

  async findAgentMembership({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<AgentMembershipModel | null> {
    return this.agentMembershipRepository.findByUserAndAgent({ userId, agentId })
  }

  async listProjectMemberAgents({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<
    Array<{
      agent: AgentSummary
      membership: AgentMembershipModel | null
    }>
  > {
    const agents = await this.agentRepository.findSummariesByProject(projectId)
    if (agents.length === 0) return []

    const memberships = await this.agentMembershipRepository.findByUserAndAgents({
      userId,
      agentIds: agents.map((agent) => agent.id),
    })
    const membershipByAgentId = new Map(
      memberships.map((membership) => [membership.agentId, membership]),
    )

    return agents.map((agent) => ({
      agent,
      membership: membershipByAgentId.get(agent.id) ?? null,
    }))
  }

  async createAgentOwnerMembership({
    agentId,
    userId,
  }: {
    agentId: string
    userId: string
  }): Promise<AgentMembershipModel> {
    return this.transactionService.run(() =>
      this.agentMembershipRepository.createMembership({ agentId, userId, role: "owner" }),
    )
  }

  /**
   * Ensures the user has a member-level agent membership.
   * Returns the existing membership when present, otherwise creates one.
   */
  async upsertAgentMemberMembership({
    agentId,
    userId,
    role = "member",
  }: {
    agentId: string
    userId: string
    role?: AgentMembershipRole
  }): Promise<AgentMembershipModel | null> {
    return this.transactionService.run(async () => {
      const existing = await this.agentMembershipRepository.findByUserAndAgent({ userId, agentId })
      if (existing) return existing

      return this.agentMembershipRepository.createMembership({ userId, agentId, role })
    })
  }

  /**
   * Removes an agent membership.
   * If the associated user is a placeholder (never accepted), also removes the user.
   */
  async removeAgentMembership({
    userId,
    membershipId,
    agentId,
  }: {
    userId: string
    membershipId: string
    agentId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const membership = await this.agentMembershipRepository.findById({ membershipId, agentId })
      if (!membership) return

      if (membership.user.id === userId) {
        throw new Error("Cannot remove yourself from the agent")
      }
      if (membership.role === "owner") {
        throw new Error("Cannot remove owner from the agent")
      }

      await this.agentMembershipRepository.deleteMembership({
        membershipId,
        agentId,
        userId: membership.userId,
      })

      if (membership.user.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)) {
        await this.userRepository.deleteById({ userId: membership.userId })
      }
    })
  }

  /**
   * Promotes or creates admin agent memberships for every agent in a project.
   * Joins an outer transaction when called inside TransactionService.run().
   */
  async createAdminAgentMembershipsForUserInProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<void> {
    const agentIds = await this.agentRepository.findIdsByProject(projectId)

    for (const agentId of agentIds) {
      const existing = await this.agentMembershipRepository.findByUserAndAgent({
        userId,
        agentId,
      })

      if (existing) {
        if (existing.role === "admin") continue

        await this.agentMembershipRepository.updateRole({
          membershipId: existing.id,
          userId,
          agentId,
          role: "admin",
        })
        continue
      }

      await this.agentMembershipRepository.createMembership({
        userId,
        agentId,
        role: "admin",
      })
    }
  }

  /**
   * Creates admin agent memberships for all project admins/owners except the
   * excluded user. Each admin is processed in its own transaction.
   */
  async createAdminAgentMembershipsForProjectAdmins({
    agentId,
    projectId,
    excludeUserId,
  }: {
    agentId: string
    projectId: string
    excludeUserId: string
  }): Promise<void> {
    const adminUserIds =
      await this.projectMembershipRepository.findAdminAndOwnerUserIdsByProject(projectId)

    for (const adminUserId of adminUserIds) {
      if (adminUserId === excludeUserId) continue

      await this.transactionService.run(async () => {
        const existing = await this.agentMembershipRepository.findByUserAndAgent({
          userId: adminUserId,
          agentId,
        })
        if (existing) return

        await this.agentMembershipRepository.createMembership({
          userId: adminUserId,
          agentId,
          role: "admin",
        })
      })
    }
  }

  /**
   * Deletes all agent memberships for a user across every agent in a project.
   * Joins an outer transaction when called inside TransactionService.run().
   */
  async deleteAgentMembershipsForUserInProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<void> {
    const agentIds = await this.agentRepository.findIdsByProject(projectId)
    if (agentIds.length === 0) return

    await this.agentMembershipRepository.deleteMembershipsForUserAndAgents({
      userId,
      agentIds,
    })
  }
}
