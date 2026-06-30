import { Injectable } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type EntityManager, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipService } from "@/domains/memberships/user-membership.service"
import { ProjectMembership, type ProjectMembershipRole } from "./project-membership.entity"
import type { ProjectMembershipModel } from "./project-membership.model"

/**
 * Repository for project memberships.
 *
 * Reads from the legacy `project_membership` table (which carries the `project`
 * and `user` relations needed to build a full `ProjectMembershipModel`).
 * Writes to both the legacy table and the unified `user_membership` table
 * (dual-write transition — see the comment in UserMembershipService).
 *
 * The service layer depends on this class exclusively; it never imports TypeORM
 * types or touches either underlying table directly.
 */
@Injectable()
export class ProjectMembershipRepository {
  constructor(
    @InjectRepository(ProjectMembership)
    private readonly legacyRepository: Repository<ProjectMembership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly userMembershipService: UserMembershipService,
  ) {}

  async findById({
    membershipId,
    projectId,
  }: {
    membershipId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const entity = await this.legacyRepository.findOne({
      where: { id: membershipId, projectId },
      relations: ["user", "project"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAllByProject(projectId: string): Promise<ProjectMembershipModel[]> {
    const entities = await this.legacyRepository.find({
      where: { projectId },
      relations: ["user", "project"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  /**
   * Creates an owner membership, writing to both the legacy and unified tables
   * atomically.
   */
  async createOwnerMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel> {
    return this.dataSource.transaction((manager) =>
      this.createMembership({ userId, projectId, role: "owner", manager }),
    )
  }

  async findByUserAndProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const entity = await this.legacyRepository.findOne({
      where: { userId, projectId },
      relations: ["user", "project"],
    })
    return entity ? this.toModel(entity) : null
  }

  /**
   * Creates a membership within a caller-owned transaction, writing to both
   * the legacy and unified tables.
   */
  async createMembership({
    userId,
    projectId,
    role,
    manager,
  }: {
    userId: string
    projectId: string
    role: ProjectMembershipRole
    manager: EntityManager
  }): Promise<ProjectMembershipModel> {
    const membershipRepo = manager.getRepository(ProjectMembership)
    const entity = membershipRepo.create({ userId, projectId, role })
    const saved = await membershipRepo.save(entity)
    await this.userMembershipService.upsertProjectMembership({ userId, projectId, role }, manager)
    const withRelations = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user", "project"],
    })
    return this.toModel(withRelations)
  }

  /**
   * Updates the role of an existing membership within a caller-owned
   * transaction, writing to both the legacy and unified tables.
   */
  async updateRole({
    membershipId,
    userId,
    projectId,
    role,
    manager,
  }: {
    membershipId: string
    userId: string
    projectId: string
    role: ProjectMembershipRole
    manager: EntityManager
  }): Promise<void> {
    const membershipRepo = manager.getRepository(ProjectMembership)
    await membershipRepo.update({ id: membershipId, projectId }, { role })
    await this.userMembershipService.upsertProjectMembership({ userId, projectId, role }, manager)
  }

  /**
   * Deletes a membership within a caller-owned transaction, removing from both
   * the legacy and unified tables.
   */
  async deleteMembership({
    membershipId,
    projectId,
    userId,
    manager,
  }: {
    membershipId: string
    projectId: string
    userId: string
    manager: EntityManager
  }): Promise<void> {
    const membershipRepo = manager.getRepository(ProjectMembership)
    await membershipRepo.delete({ id: membershipId, projectId })
    await this.userMembershipService.deleteProjectMembership({ userId, projectId }, manager)
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
