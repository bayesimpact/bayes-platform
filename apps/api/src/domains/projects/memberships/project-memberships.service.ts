import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import type { ProjectMembershipModel } from "./project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "./project-membership.repository"

export const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly projectMembershipRepository: ProjectMembershipRepository,
    private readonly transactionService: TransactionService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly userRepository: UserRepository,
  ) {}

  async listProjectMemberships(projectId: string): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByProject(projectId)
  }

  async listMembershipsForUser(userId: string): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByUser(userId)
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
    return this.transactionService.run(() =>
      this.projectMembershipRepository.createMembership({ projectId, userId, role: "owner" }),
    )
  }

  /**
   * Ensures the given user has an admin (or higher) membership in the project.
   *
   * - If they are already an admin, returns null (no-op).
   * - If they have a lower role, promotes them to admin and syncs their agent
   *   memberships.
   * - If they have no membership, creates an admin one.
   *
   * Owns its transaction via TransactionService.run(). Can safely be called
   * from within another run() context — the "join or start" propagation means
   * it will participate in the outer transaction rather than starting a new one.
   */
  async upsertProjectAdminMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId,
        projectId,
      })

      if (existing?.role === "admin") return null

      if (existing) {
        await this.projectMembershipRepository.updateRole({
          membershipId: existing.id,
          userId,
          projectId,
          role: "admin",
        })
        await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
          userId,
          projectId,
        })
        return null
      }

      const membership = await this.projectMembershipRepository.createMembership({
        userId,
        projectId,
        role: "admin",
      })
      await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
        userId,
        projectId,
      })
      return membership
    })
  }

  /**
   * Ensures the user has a member-level project membership.
   * Returns the existing membership when present, otherwise creates one.
   */
  async upsertProjectMemberMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId,
        projectId,
      })
      if (existing) return existing

      return this.projectMembershipRepository.createMembership({
        userId,
        projectId,
        role: "member",
      })
    })
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
    return this.transactionService.run(async () => {
      const membership = await this.projectMembershipRepository.findById({
        membershipId,
        projectId,
      })
      if (!membership) return

      if (membership.user.id === userId) {
        throw new Error("Cannot remove yourself from the project")
      }

      if (membership.role === "owner") {
        throw new Error("Cannot remove owner from the project")
      }

      await this.agentMembershipsService.deleteAgentMembershipsForUserInProject({
        userId: membership.userId,
        projectId,
      })

      await this.projectMembershipRepository.deleteMembership({
        membershipId,
        projectId,
        userId: membership.userId,
      })

      if (membership.user.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)) {
        await this.userRepository.deleteById({ userId: membership.userId })
      }
    })
  }
}
