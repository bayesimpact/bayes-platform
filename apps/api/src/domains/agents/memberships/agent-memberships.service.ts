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
import type { AgentMembershipModel } from "./agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipRepository } from "./agent-membership.repository"
import type { AgentMembershipRole } from "./agent-membership.types"

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
   * Soft-deletes all agent memberships for the given agent.
   * Joins an outer transaction when called inside TransactionService.run().
   */
  async deleteMembership({ agentId }: { agentId: string }): Promise<void> {
    await this.agentMembershipRepository.softDeleteAllByAgent(agentId)
  }

  /**
   * Removes an agent membership.
   * If the user was added by email and never signed in, also removes the
   * account once it has no membership left.
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

      await this.userRepository.deleteIfUnusedPlaceholder({ userId: membership.userId })
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
   * Turns the user's admin agent memberships in a project into member ones, the
   * reverse of createAdminAgentMembershipsForUserInProject. Agent ownership stays.
   * Joins an outer transaction when called inside TransactionService.run().
   */
  async demoteAdminAgentMembershipsForUserInProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<void> {
    const agentIds = await this.agentRepository.findIdsByProject(projectId)
    const memberships = await this.agentMembershipRepository.findByUserAndAgents({
      userId,
      agentIds,
    })

    for (const membership of memberships) {
      if (membership.role !== "admin") continue

      await this.agentMembershipRepository.updateRole({
        membershipId: membership.id,
        userId,
        agentId: membership.agentId,
        role: "member",
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
