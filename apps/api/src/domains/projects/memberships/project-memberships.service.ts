import { Injectable } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipService } from "@/domains/memberships/user-membership.service"
import { User } from "@/domains/users/user.entity"
import { ProjectMembership } from "./project-membership.entity"

export const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

@Injectable()
export class ProjectMembershipsService {
  constructor(
    @InjectRepository(ProjectMembership)
    private readonly projectMembershipRepository: Repository<ProjectMembership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly userMembershipService: UserMembershipService,
  ) {}

  async findById(membershipId: string): Promise<ProjectMembership | null> {
    return this.projectMembershipRepository.findOne({
      where: { id: membershipId },
      relations: ["user"],
    })
  }

  async listProjectMemberships(projectId: string): Promise<ProjectMembership[]> {
    return this.projectMembershipRepository.find({
      where: { projectId },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
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
  }): Promise<ProjectMembership> {
    const membership = this.projectMembershipRepository.create({
      projectId,
      userId,
      role: "owner",
    })
    const saved = await this.projectMembershipRepository.save(membership)
    await this.userMembershipService.upsertProjectMembership({
      userId,
      projectId,
      role: "owner",
    })
    return saved
  }

  async upsertProjectAdminMembership(params: {
    manager: EntityManager
    projectId: string
    userId: string
  }): Promise<ProjectMembership | null> {
    const membershipRepo = params.manager.getRepository(ProjectMembership)
    const existingMembership = await membershipRepo.findOne({
      where: { projectId: params.projectId, userId: params.userId },
    })

    if (existingMembership) {
      if (existingMembership.role !== "admin") {
        existingMembership.role = "admin"
        await membershipRepo.save(existingMembership)
        await this.userMembershipService.upsertProjectMembership(
          { userId: params.userId, projectId: params.projectId, role: "admin" },
          params.manager,
        )
        await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
          manager: params.manager,
          userId: params.userId,
          projectId: params.projectId,
        })
      }
      return null
    }

    const newMembership = membershipRepo.create({
      projectId: params.projectId,
      userId: params.userId,
      role: "admin",
    })
    const savedMembership = await membershipRepo.save(newMembership)
    await this.userMembershipService.upsertProjectMembership(
      { userId: params.userId, projectId: params.projectId, role: "admin" },
      params.manager,
    )
    return savedMembership
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
      const membershipRepo = manager.getRepository(ProjectMembership)
      const userRepo = manager.getRepository(User)

      const membership = await this.findById(membershipId)
      if (!membership) return

      const { user } = membership

      if (user.id === userId) {
        throw new Error("Cannot remove yourself from the project")
      }

      if (membership.role === "owner") {
        throw new Error("Cannot remove owner from the project")
      }

      // Also delete all agent memberships for this user in the project
      await this.agentMembershipsService.deleteAgentMembershipsForUserInProject({
        manager,
        userId: user.id,
        projectId,
      })

      await membershipRepo.delete({ id: membershipId, projectId })
      await this.userMembershipService.deleteProjectMembership(
        { userId: user.id, projectId },
        manager,
      )

      // If the user is a placeholder (never signed up), clean them up
      if (user.auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX)) {
        await userRepo.delete({ id: user.id })
      }
    })
  }
}
