import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import type { ProjectMembershipModel } from "./project-membership.model"
import type { ProjectMembershipRole } from "./project-membership.types"

const PROJECT_RESOURCE_TYPE = "project" as const

/**
 * Repository for project memberships.
 *
 * Reads and writes the unified `user_membership` table with
 * `resourceType = 'project'`.
 */
@Injectable()
export class ProjectMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findById({
    membershipId,
    projectId,
  }: {
    membershipId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        id: membershipId,
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const project = await this.projectRepo().findOne({ where: { id: projectId } })
    if (!project) return null

    return this.toModel(membership, project)
  }

  async findAllByProject(projectId: string): Promise<ProjectMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    const project = await this.projectRepo().findOneOrFail({ where: { id: projectId } })
    return memberships.map((membership) => this.toModel(membership, project))
  }

  async findAllByUser(userId: string): Promise<ProjectMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: PROJECT_RESOURCE_TYPE },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAdminAndOwnerByUser(userId: string): Promise<ProjectMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: [
        { userId, resourceType: PROJECT_RESOURCE_TYPE, role: "admin" },
        { userId, resourceType: PROJECT_RESOURCE_TYPE, role: "owner" },
      ],
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findAllByProjectIds(projectIds: string[]): Promise<ProjectMembershipModel[]> {
    if (projectIds.length === 0) return []

    const memberships = await this.userMembershipRepo().find({
      where: { resourceType: PROJECT_RESOURCE_TYPE, resourceId: In(projectIds) },
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findByUserAndProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        userId,
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const project = await this.projectRepo().findOne({ where: { id: projectId } })
    if (!project) return null

    return this.toModel(membership, project)
  }

  async findAnyByUserAndOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<ProjectMembershipModel | null> {
    const membership = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .innerJoin(Project, "project", "project.id = membership.resource_id")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: PROJECT_RESOURCE_TYPE })
      .andWhere("project.organizationId = :organizationId", { organizationId })
      .getOne()
    if (!membership) return null

    const project = await this.projectRepo().findOneOrFail({ where: { id: membership.resourceId } })
    return this.toModel(membership, project)
  }

  async findAdminAndOwnerUserIdsByProject(projectId: string): Promise<string[]> {
    const memberships = await this.userMembershipRepo().find({
      where: [
        { resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId, role: "admin" },
        { resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId, role: "owner" },
      ],
      select: { userId: true },
    })
    return memberships.map((membership) => membership.userId)
  }

  async createMembership({
    userId,
    projectId,
    role,
  }: {
    userId: string
    projectId: string
    role: ProjectMembershipRole
  }): Promise<ProjectMembershipModel> {
    const saved = await this.userMembershipRepo().save(
      this.userMembershipRepo().create({
        userId,
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
        role,
      }),
    )
    const withUser = await this.userMembershipRepo().findOneOrFail({
      where: { id: saved.id },
      relations: ["user"],
    })
    const project = await this.projectRepo().findOneOrFail({ where: { id: projectId } })
    return this.toModel(withUser, project)
  }

  async updateRole({
    membershipId,
    projectId,
    role,
  }: {
    membershipId: string
    userId: string
    projectId: string
    role: ProjectMembershipRole
  }): Promise<void> {
    await this.userMembershipRepo().update(
      {
        id: membershipId,
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
      },
      { role },
    )
  }

  async deleteMembership({
    membershipId,
    projectId,
    userId,
  }: {
    membershipId: string
    projectId: string
    userId: string
  }): Promise<void> {
    await this.userMembershipRepo().delete({
      id: membershipId,
      userId,
      resourceType: PROJECT_RESOURCE_TYPE,
      resourceId: projectId,
    })
  }

  async softDeleteAllByProject(projectId: string): Promise<void> {
    await this.userMembershipRepo().softDelete({
      resourceType: PROJECT_RESOURCE_TYPE,
      resourceId: projectId,
    })
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private projectRepo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }

  private async toModels(memberships: UserMembership[]): Promise<ProjectMembershipModel[]> {
    if (memberships.length === 0) return []

    const projectIds = [...new Set(memberships.map((membership) => membership.resourceId))]
    const projects = await this.projectRepo().find({ where: { id: In(projectIds) } })
    const projectById = new Map(projects.map((project) => [project.id, project]))

    return memberships.flatMap((membership) => {
      const project = projectById.get(membership.resourceId)
      return project ? [this.toModel(membership, project)] : []
    })
  }

  private toModel(membership: UserMembership, project: Project): ProjectMembershipModel {
    return {
      id: membership.id,
      userId: membership.userId,
      projectId: membership.resourceId,
      role: membership.role as ProjectMembershipRole,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
      user: membership.user,
      project,
    }
  }
}
