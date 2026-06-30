import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type EntityManager } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import { User } from "@/domains/users/user.entity"
import type { ProjectMembershipModel } from "./project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "./project-membership.repository"

export const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly projectMembershipRepository: ProjectMembershipRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly agentMembershipsService: AgentMembershipsService,
  ) {}

  async listProjectMemberships(projectId: string): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByProject(projectId)
  }

  async listMemberAgents(params: { projectId: string; userId: string }) {
    return this.agentMembershipsService.listProjectMemberAgents(params)
  }

  async createProjectOwnerMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel> {
    return this.projectMembershipRepository.createOwnerMembership({ projectId, userId })
  }

  async upsertProjectAdminMembership({
    manager,
    projectId,
    userId,
  }: {
    manager: EntityManager
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel | null> {
    const existing = await this.projectMembershipRepository.findByUserAndProject({ userId, projectId })

    if (existing?.role === "admin") return null

    if (existing) {
      await this.projectMembershipRepository.updateRole({
        membershipId: existing.id,
        userId,
        projectId,
        role: "admin",
        manager,
      })
      await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
        manager,
        userId,
        projectId,
      })
      return null
    }

    return this.projectMembershipRepository.createMembership({ userId, projectId, role: "admin", manager })
  }

  /**
   * Removes a project membership.
   * If the associated user is a placeholder (never accepted the invitation),
   * also deletes the placeholder user to avoid orphaned records.
   */
  async removeProjectMembership({
    userId,
    membershipId,
    projectId,
  }: {
    userId: string
    membershipId: string
    projectId: string
  }): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const membership = await this.projectMembershipRepository.findById({ membershipId, projectId })
      if (!membership) return

      if (membership.user.id === userId) {
        throw new Error("Cannot remove yourself from the project")
      }

      if (membership.role === "owner") {
        throw new Error("Cannot remove owner from the project")
      }

      await this.agentMembershipsService.deleteAgentMembershipsForUserInProject({
        manager,
        userId: membership.userId,
        projectId,
      })

      await this.projectMembershipRepository.deleteMembership({
        membershipId,
        projectId,
        userId: membership.userId,
        manager,
      })

      if (membership.user.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)) {
        await manager.getRepository(User).delete({ id: membership.userId })
      }
    })
  }
}
