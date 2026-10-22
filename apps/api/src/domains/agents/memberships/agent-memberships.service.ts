import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { AgentSummary } from "@/domains/agents/agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "@/domains/agents/agent.repository"
import { hasRole } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import { AGENT_ROLES, PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import type { AgentMembershipModel } from "./agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipRepository } from "./agent-membership.repository"
import type { AgentMembershipRole } from "./agent-membership.types"

/**
 * The agent roles managed from the studio. `agent_conversation_reviewer` is granted and revoked
 * in the backoffice only, so the agent's own admins neither see nor remove it.
 */
const MEMBER_ROLE_KEYS: readonly string[] = Object.values(AGENT_ROLES)

/** The membership as the studio sees it: its member roles only, or null without one. */
function toMemberView(membership: AgentMembershipModel): AgentMembershipModel | null {
  const roles = membership.roles.filter((role) => MEMBER_ROLE_KEYS.includes(role.key))
  return roles.length > 0 ? { ...membership, roles } : null
}

@Injectable()
export class AgentMembershipsService {
  constructor(
    private readonly agentMembershipRepository: AgentMembershipRepository,
    private readonly agentRepository: AgentRepository,
    private readonly projectMembershipRepository: ProjectMembershipRepository,
    private readonly transactionService: TransactionService,
    private readonly userRepository: UserRepository,
  ) {}

  /** The agent's members, with their member roles (owner, admin, member). */
  async listAgentMemberships(agentId: string): Promise<AgentMembershipModel[]> {
    const memberships = await this.agentMembershipRepository.findAllByAgent(agentId)
    return memberships.flatMap((membership) => toMemberView(membership) ?? [])
  }

  async listMembershipsForUser(userId: string): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAllByUser(userId)
  }

  async listMembershipsByAgentIds(agentIds: string[]): Promise<AgentMembershipModel[]> {
    return this.agentMembershipRepository.findAllByAgentIds(agentIds)
  }

  /** The user's member roles on the agent (owner, admin, member), or null without one. */
  async findAgentMembership({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<AgentMembershipModel | null> {
    const membership = await this.agentMembershipRepository.findByUserAndAgent({ userId, agentId })
    return membership ? toMemberView(membership) : null
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
      memberships.flatMap((membership) => {
        const memberView = toMemberView(membership)
        return memberView ? [[membership.agentId, memberView] as const] : []
      }),
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
      this.agentMembershipRepository.createMembership({
        agentId,
        userId,
        roleKey: AGENT_ROLES.owner,
      }),
    )
  }

  /**
   * Ensures the user holds a member role on the agent (owner, admin or member).
   * Returns the existing membership when present, otherwise creates one with the given role.
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
      const existing = await this.findAgentMembership({ userId, agentId })
      if (existing) return existing

      return this.agentMembershipRepository.createMembership({
        userId,
        agentId,
        roleKey: AGENT_ROLES[role],
      })
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
   * Removes a person's member roles on the agent. A conversation reviewer grant stays: only the
   * backoffice revokes it. Nobody removes themselves, and the agent's owner stays.
   * If the user was added by email and never signed in, also removes the
   * account once it has no membership left.
   */
  async removeAgentMembership({
    callerUserId,
    memberUserId,
    agentId,
  }: {
    callerUserId: string
    memberUserId: string
    agentId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const membership = await this.findAgentMembership({ userId: memberUserId, agentId })
      if (!membership) return

      if (membership.userId === callerUserId) {
        throw new Error("Cannot remove yourself from the agent")
      }
      if (hasRole(membership, AGENT_ROLES.owner)) {
        throw new Error("Cannot remove owner from the agent")
      }

      await this.agentMembershipRepository.deleteMembershipsForUserAndAgents({
        userId: membership.userId,
        agentIds: [agentId],
        roleKeys: [...MEMBER_ROLE_KEYS],
      })

      await this.userRepository.deleteIfUnusedPlaceholder({ userId: membership.userId })
    })
  }

  /**
   * Gives the user `agent_admin` on every agent of a project, in place of `agent_member` where
   * they held it. Their other agent roles stay.
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
    const memberships = await this.agentMembershipRepository.findByUserAndAgents({
      userId,
      agentIds,
    })
    const membershipByAgentId = new Map(
      memberships.map((membership) => [membership.agentId, membership]),
    )

    for (const agentId of agentIds) {
      const existing = membershipByAgentId.get(agentId)
      if (existing && hasRole(existing, AGENT_ROLES.admin)) continue

      if (existing && hasRole(existing, AGENT_ROLES.member)) {
        await this.agentMembershipRepository.switchRole({
          userId,
          agentId,
          fromRoleKey: AGENT_ROLES.member,
          toRoleKey: AGENT_ROLES.admin,
        })
        continue
      }

      await this.agentMembershipRepository.addRole({ userId, agentId, roleKey: AGENT_ROLES.admin })
    }
  }

  /**
   * Turns the user's `agent_admin` roles in a project into `agent_member`, the reverse of
   * createAdminAgentMembershipsForUserInProject. Agent ownership stays.
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
      if (!hasRole(membership, AGENT_ROLES.admin)) continue

      await this.agentMembershipRepository.switchRole({
        userId,
        agentId: membership.agentId,
        fromRoleKey: AGENT_ROLES.admin,
        toRoleKey: AGENT_ROLES.member,
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
    const adminUserIds = await this.projectMembershipRepository.findUserIdsHoldingRoles({
      projectId,
      roleKeys: [PROJECT_ROLES.owner, PROJECT_ROLES.admin],
    })

    for (const adminUserId of adminUserIds) {
      if (adminUserId === excludeUserId) continue

      await this.transactionService.run(async () => {
        const existing = await this.findAgentMembership({ userId: adminUserId, agentId })
        if (existing) return

        await this.agentMembershipRepository.addRole({
          userId: adminUserId,
          agentId,
          roleKey: AGENT_ROLES.admin,
        })
      })
    }
  }

  /**
   * Deletes the user's member roles on every agent of a project. Conversation reviewer grants
   * stay: only the backoffice revokes them.
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
      roleKeys: [...MEMBER_ROLE_KEYS],
    })
  }
}
