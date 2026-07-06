import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import { ProjectMembership, type ProjectMembershipRole } from "./project-membership.entity"
import type { ProjectMembershipModel } from "./project-membership.model"

/**
 * Repository for project memberships.
 *
 * Reads from the legacy `project_membership` table (which carries the `project`
 * and `user` relations needed to build a full `ProjectMembershipModel`).
 * Writes to both the legacy table and the unified `user_membership` table
 * (dual-write transition).
 *
 * All write methods participate in whatever transaction is active in the
 * current async context (via TransactionService.getManager()). The service
 * layer is responsible for starting and committing transactions using
 * TransactionService.run().
 */
@Injectable()
export class ProjectMembershipRepository {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findById({
    membershipId,
    projectId,
  }: {
    membershipId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { id: membershipId, projectId },
      relations: ["user", "project"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAllByProject(projectId: string): Promise<ProjectMembershipModel[]> {
    const entities = await this.repo().find({
      where: { projectId },
      relations: ["user", "project"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByUser(userId: string): Promise<ProjectMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId },
      relations: ["user", "project"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findByUserAndProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { userId, projectId },
      relations: ["user", "project"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAnyByUserAndOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<ProjectMembershipModel | null> {
    const entity = await this.repo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.project", "project")
      .innerJoinAndSelect("membership.user", "user")
      .where("membership.userId = :userId", { userId })
      .andWhere("project.organizationId = :organizationId", { organizationId })
      .getOne()
    return entity ? this.toModel(entity) : null
  }

  async findAdminAndOwnerUserIdsByProject(projectId: string): Promise<string[]> {
    const entities = await this.repo().find({
      where: [
        { projectId, role: "admin" },
        { projectId, role: "owner" },
      ],
      select: { userId: true },
    })
    return entities.map((entity) => entity.userId)
  }

  /**
   * Creates a membership, writing to both the legacy and unified tables.
   * Must be called from within a TransactionService.run() context.
   */
  async createMembership({
    userId,
    projectId,
    role,
  }: {
    userId: string
    projectId: string
    role: ProjectMembershipRole
  }): Promise<ProjectMembershipModel> {
    const membershipRepo = this.repo()
    const entity = membershipRepo.create({ userId, projectId, role })
    const saved = await membershipRepo.save(entity)
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "project",
      resourceId: projectId,
      role,
    })
    const withRelations = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user", "project"],
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
    projectId,
    role,
  }: {
    membershipId: string
    userId: string
    projectId: string
    role: ProjectMembershipRole
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.update({ id: membershipId, projectId }, { role })
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "project",
      resourceId: projectId,
      role,
    })
  }

  /**
   * Deletes a membership from both tables.
   * Must be called from within a TransactionService.run() context.
   */
  async deleteMembership({
    membershipId,
    projectId,
    userId,
  }: {
    membershipId: string
    projectId: string
    userId: string
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.delete({ id: membershipId, projectId })
    await this.userMembershipRepository.deleteMembership({
      userId,
      resourceType: "project",
      resourceId: projectId,
    })
  }

  private repo(): Repository<ProjectMembership> {
    return this.transactionService.getManager().getRepository(ProjectMembership)
  }

  private toModel(entity: ProjectMembership): ProjectMembershipModel {
    return {
      id: entity.id,
      userId: entity.userId,
      projectId: entity.projectId,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      user: entity.user,
      project: entity.project,
    }
  }
}
