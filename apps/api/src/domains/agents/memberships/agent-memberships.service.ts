import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In } from "typeorm"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { User } from "@/domains/users/user.entity"
import { Agent } from "../agent.entity"
import { AgentMembership } from "./agent-membership.entity"

export const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

@Injectable()
export class AgentMembershipsService {
  constructor(
    @InjectRepository(AgentMembership)
    private readonly agentMembershipRepository: Repository<AgentMembership>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(membershipId: string): Promise<AgentMembership | null> {
    return this.agentMembershipRepository.findOne({
      where: { id: membershipId },
      relations: ["user", "agent"],
    })
  }

  async listAgentMemberships(agentId: string): Promise<AgentMembership[]> {
    return this.agentMembershipRepository.find({
      where: { agentId },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
  }

  async listProjectMemberAgents({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<
    Array<{
      agent: Pick<Agent, "id" | "name" | "type">
      membership: AgentMembership | null
    }>
  > {
    const agents = await this.dataSource.getRepository(Agent).find({
      where: { projectId },
      select: { id: true, name: true, type: true },
      order: { createdAt: "ASC" },
    })

    if (agents.length === 0) return []

    const memberships = await this.agentMembershipRepository.find({
      where: { userId, agentId: In(agents.map((agent) => agent.id)) },
    })
    const membershipByAgentId = new Map(
      memberships.map((membership) => [membership.agentId, membership]),
    )

    return agents.map((agent) => ({
      agent,
      membership: membershipByAgentId.get(agent.id) ?? null,
    }))
  }

  async createAgentOwnerMembership(params: {
    agentId: string
    userId: string
  }): Promise<AgentMembership> {
    const membership = this.agentMembershipRepository.create({
      agentId: params.agentId,
      userId: params.userId,
      role: "owner",
      status: "accepted",
      invitationToken: `new_agent_no_invitation_token-${randomUUID()}`,
    })
    return this.agentMembershipRepository.save(membership)
  }

  async upsertAgentMemberMembership(params: {
    manager: EntityManager
    agentId: string
    userId: string
    invitationToken: string
  }): Promise<AgentMembership | null> {
    const membershipRepo = params.manager.getRepository(AgentMembership)
    const existingMembership = await membershipRepo.findOne({
      where: { agentId: params.agentId, userId: params.userId },
    })

    if (existingMembership) {
      return existingMembership
    }

    const newMembership = membershipRepo.create({
      agentId: params.agentId,
      userId: params.userId,
      invitationToken: params.invitationToken,
      status: "sent",
      role: "member",
    })
    return membershipRepo.save(newMembership)
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
    return this.dataSource.transaction(async (manager) => {
      const membershipRepo = manager.getRepository(AgentMembership)
      const userRepo = manager.getRepository(User)
      const projectMembershipRepo = manager.getRepository(ProjectMembership)
      const organizationMembershipRepo = manager.getRepository(OrganizationMembership)

      // when calling findById, we use another DB transaction, it's not ideal but it's ok for this use case
      const membership = await this.findById(membershipId)
      if (!membership) return

      if (membership.user.id === userId) {
        throw new Error("Cannot remove yourself from the agent")
      }
      if (membership.role === "owner") {
        throw new Error("Cannot remove owner from the agent")
      }

      await membershipRepo.delete({ id: membershipId, agentId })

      const memberships = await membershipRepo.find({
        where: { id: membershipId, agentId },
        relations: ["user"],
      })

      if (memberships.length === 0) {
        // If the user has no more memberships for this agent, also remove their ProjectMembership and OrganizationMembership related to this agent's project and organization
        await projectMembershipRepo.delete({
          userId: membership.user.id,
          projectId: membership.agent.projectId,
        })
        await organizationMembershipRepo.delete({
          userId: membership.user.id,
          organizationId: membership.agent.organizationId,
        })
      }

      if (membership.user.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)) {
        // If the user is a placeholder (never signed up), clean them up
        await userRepo.delete({ id: membership.user.id })
      }
    })
  }

  async createAdminAgentMembershipsForUserInProject({
    manager,
    userId,
    projectId,
  }: {
    manager: EntityManager
    userId: string
    projectId: string
  }): Promise<void> {
    const agents = await manager.find(Agent, {
      where: { projectId },
      select: { id: true },
    })

    for (const agent of agents) {
      const existing = await manager.findOne(AgentMembership, {
        where: { agentId: agent.id, userId },
      })
      if (existing) {
        if (existing.role !== "admin") {
          existing.role = "admin"
          await manager.save(AgentMembership, existing)
        }
        continue
      }

      const membership = manager.create(AgentMembership, {
        agentId: agent.id,
        userId,
        role: "admin",
        status: "accepted",
        invitationToken: `project_invite-${randomUUID()}`,
      })
      await manager.save(AgentMembership, membership)
    }
  }

  async createAdminAgentMembershipsForProjectAdmins({
    agentId,
    projectId,
    excludeUserId,
  }: {
    agentId: string
    projectId: string
    excludeUserId: string
  }): Promise<void> {
    const projectMemberships = await this.dataSource.getRepository(ProjectMembership).find({
      where: [
        { projectId, role: "admin" },
        { projectId, role: "owner" },
      ],
    })

    for (const projectMembership of projectMemberships) {
      if (projectMembership.userId === excludeUserId) continue

      const existing = await this.agentMembershipRepository.findOne({
        where: { agentId, userId: projectMembership.userId },
      })
      if (existing) continue

      const membership = this.agentMembershipRepository.create({
        agentId,
        userId: projectMembership.userId,
        role: "admin",
        status: "accepted",
        invitationToken: `project_admin_propagation-${randomUUID()}`,
      })
      await this.agentMembershipRepository.save(membership)
    }
  }

  async deleteAgentMembershipsForUserInProject({
    manager,
    userId,
    projectId,
  }: {
    manager: EntityManager
    userId: string
    projectId: string
  }): Promise<void> {
    const agents = await manager.find(Agent, { where: { projectId }, select: { id: true } })
    if (agents.length === 0) return

    const agentIds = agents.map((agent) => agent.id)
    await manager.delete(AgentMembership, { agentId: In(agentIds), userId })
  }
}
