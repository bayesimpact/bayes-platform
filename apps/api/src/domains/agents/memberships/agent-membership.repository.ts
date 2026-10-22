import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Agent } from "@/domains/agents/agent.entity"
import {
  groupMembershipRows,
  type MembershipRowGroup,
  resourceIdOf,
} from "@/domains/memberships/membership-roles"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { requireRoleId } from "@/domains/rbac/resolve-role-id"
import { HUMAN_USER_TYPE_FILTER } from "@/domains/users/service-user.helpers"
import type { AgentMembershipModel } from "./agent-membership.model"

const AGENT_RESOURCE_TYPE = "agent" as const
const MEMBERSHIP_RELATIONS = { user: true, rbacRole: true } as const

/**
 * Repository for agent memberships.
 *
 * Reads and writes the unified `user_membership` table with `resourceType = 'agent'`. A person
 * holds one row per role on an agent; reads group them into one model per person.
 */
@Injectable()
export class AgentMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findAllByAgent(agentId: string): Promise<AgentMembershipModel[]> {
    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: AGENT_RESOURCE_TYPE,
        resourceId: agentId,
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    const agent = await this.agentRepo().findOneOrFail({ where: { id: agentId } })
    return this.newestFirst(groupMembershipRows(rows)).map((group) => this.toModel(group, agent))
  }

  async findAllByUser(userId: string): Promise<AgentMembershipModel[]> {
    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: AGENT_RESOURCE_TYPE },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(this.newestFirst(groupMembershipRows(rows)))
  }

  async findAllByAgentIds(agentIds: string[]): Promise<AgentMembershipModel[]> {
    if (agentIds.length === 0) return []

    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: AGENT_RESOURCE_TYPE,
        resourceId: In(agentIds),
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(groupMembershipRows(rows))
  }

  async findByUserAndAgent({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<AgentMembershipModel | null> {
    const [membership] = await this.findByUserAndAgents({ userId, agentIds: [agentId] })
    return membership ?? null
  }

  async findByUserAndAgents({
    userId,
    agentIds,
  }: {
    userId: string
    agentIds: string[]
  }): Promise<AgentMembershipModel[]> {
    if (agentIds.length === 0) return []

    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: AGENT_RESOURCE_TYPE, resourceId: In(agentIds) },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(groupMembershipRows(rows))
  }

  /** Gives the person the role on the agent. Does nothing when they already hold it. */
  async addRole({
    userId,
    agentId,
    roleKey,
  }: {
    userId: string
    agentId: string
    roleKey: string
  }): Promise<void> {
    const roleId = await requireRoleId(this.transactionService.getManager(), roleKey)
    await this.userMembershipRepo()
      .createQueryBuilder()
      .insert()
      .values({ userId, resourceType: AGENT_RESOURCE_TYPE, resourceId: agentId, roleId })
      .orIgnore()
      .execute()
  }

  /**
   * Moves the person from one role to another on the agent, keeping the row (and so its id) when
   * they did not hold the new role yet. Does nothing when they do not hold the old one.
   */
  async switchRole({
    userId,
    agentId,
    fromRoleKey,
    toRoleKey,
  }: {
    userId: string
    agentId: string
    fromRoleKey: string
    toRoleKey: string
  }): Promise<void> {
    const manager = this.transactionService.getManager()
    const fromRoleId = await requireRoleId(manager, fromRoleKey)
    const toRoleId = await requireRoleId(manager, toRoleKey)
    const where = { userId, resourceType: AGENT_RESOURCE_TYPE, resourceId: agentId }

    const holdsTarget = await this.userMembershipRepo().exists({
      where: { ...where, roleId: toRoleId },
    })
    if (holdsTarget) {
      await this.userMembershipRepo().delete({ ...where, roleId: fromRoleId })
      return
    }
    await this.userMembershipRepo().update({ ...where, roleId: fromRoleId }, { roleId: toRoleId })
  }

  async createMembership({
    userId,
    agentId,
    roleKey,
  }: {
    userId: string
    agentId: string
    roleKey: string
  }): Promise<AgentMembershipModel> {
    await this.addRole({ userId, agentId, roleKey })
    const membership = await this.findByUserAndAgent({ userId, agentId })
    if (!membership) throw new Error(`Agent ${agentId} not found`)
    return membership
  }

  /** Removes the roles the person holds on the agents, or every role when `roleKeys` is omitted. */
  async deleteMembershipsForUserAndAgents({
    userId,
    agentIds,
    roleKeys,
  }: {
    userId: string
    agentIds: string[]
    roleKeys?: string[]
  }): Promise<void> {
    if (agentIds.length === 0) return

    await this.transactionService.getManager().query(
      `DELETE FROM user_membership AS membership
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id = ANY($3)
         AND (
           $4::varchar[] IS NULL
           OR membership.role_id IN (SELECT role.id FROM role WHERE role.key = ANY($4))
         )`,
      [userId, AGENT_RESOURCE_TYPE, agentIds, roleKeys ?? null],
    )
  }

  async softDeleteAllByAgent(agentId: string): Promise<void> {
    await this.userMembershipRepo().softDelete({
      resourceType: AGENT_RESOURCE_TYPE,
      resourceId: agentId,
    })
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private agentRepo(): Repository<Agent> {
    return this.transactionService.getManager().getRepository(Agent)
  }

  private newestFirst(groups: MembershipRowGroup[]): MembershipRowGroup[] {
    return [...groups].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  }

  private async toModels(groups: MembershipRowGroup[]): Promise<AgentMembershipModel[]> {
    if (groups.length === 0) return []

    const agentIds = [...new Set(groups.map((group) => resourceIdOf(group)))]
    const agents = await this.agentRepo().find({ where: { id: In(agentIds) } })
    const agentById = new Map(agents.map((agent) => [agent.id, agent]))

    return groups.flatMap((group) => {
      const agent = agentById.get(resourceIdOf(group))
      return agent ? [this.toModel(group, agent)] : []
    })
  }

  private toModel(group: MembershipRowGroup, agent: Agent): AgentMembershipModel {
    return {
      userId: group.userId,
      agentId: resourceIdOf(group),
      roles: group.roles,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      user: group.user,
      agent,
    }
  }
}
