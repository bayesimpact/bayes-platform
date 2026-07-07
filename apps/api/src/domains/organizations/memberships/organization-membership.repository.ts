import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import type { Organization } from "@/domains/organizations/organization.entity"
import {
  OrganizationMembership,
  type OrganizationMembershipRole,
} from "./organization-membership.entity"
import type { OrganizationMembershipModel } from "./organization-membership.model"

/**
 * Repository for organization memberships.
 *
 * Reads from the legacy `organization_membership` table. Writes to both the
 * legacy table and the unified `user_membership` table (dual-write transition).
 *
 * All write methods participate in whatever transaction is active in the
 * current async context (via TransactionService.getManager()). The service
 * layer is responsible for starting transactions using TransactionService.run().
 */
@Injectable()
export class OrganizationMembershipRepository {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findByUserAndOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<OrganizationMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { userId, organizationId },
      relations: ["user", "organization"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAllByUser(userId: string): Promise<OrganizationMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId },
      relations: ["user", "organization"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAdminAndOwnerByUser(userId: string): Promise<OrganizationMembershipModel[]> {
    const entities = await this.repo().find({
      where: [
        { userId, role: "admin" },
        { userId, role: "owner" },
      ],
      relations: ["user", "organization"],
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByOrganization(organizationId: string): Promise<OrganizationMembershipModel[]> {
    const entities = await this.repo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .where("membership.organizationId = :organizationId", { organizationId })
      .orderBy("LOWER(user.email)", "ASC")
      .getMany()
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByOrganizationIds(
    organizationIds: string[],
  ): Promise<OrganizationMembershipModel[]> {
    if (organizationIds.length === 0) return []

    const entities = await this.repo().find({
      where: { organizationId: In(organizationIds) },
      relations: ["user", "organization"],
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findOwnerByUserAndOrganizationName({
    userId,
    organizationName,
  }: {
    userId: string
    organizationName: string
  }): Promise<OrganizationMembershipModel | null> {
    const entity = await this.repo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.organization", "organization")
      .innerJoinAndSelect("membership.user", "user")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.role = :role", { role: "owner" })
      .andWhere("LOWER(organization.name) = LOWER(:organizationName)", { organizationName })
      .getOne()
    return entity ? this.toModel(entity) : null
  }

  /**
   * Creates a membership, writing to both the legacy and unified tables.
   * Must be called from within a TransactionService.run() context.
   */
  async createMembership({
    userId,
    organizationId,
    role,
  }: {
    userId: string
    organizationId: string
    role: OrganizationMembershipRole
  }): Promise<OrganizationMembershipModel> {
    const membershipRepo = this.repo()
    const entity = membershipRepo.create({ userId, organizationId, role })
    const saved = await membershipRepo.save(entity)
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "organization",
      resourceId: organizationId,
      role,
    })
    const withRelations = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user", "organization"],
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
    organizationId,
    role,
  }: {
    membershipId: string
    userId: string
    organizationId: string
    role: OrganizationMembershipRole
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.update({ id: membershipId, organizationId }, { role })
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "organization",
      resourceId: organizationId,
      role,
    })
  }

  /**
   * Deletes a membership from both tables.
   * Must be called from within a TransactionService.run() context.
   */
  async deleteMembership({
    membershipId,
    organizationId,
    userId,
  }: {
    membershipId: string
    organizationId: string
    userId: string
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.delete({ id: membershipId, organizationId })
    await this.userMembershipRepository.deleteMembership({
      userId,
      resourceType: "organization",
      resourceId: organizationId,
    })
  }

  /** Returns organizations the user belongs to (convenience for list endpoints). */
  async findOrganizationsForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.findAllByUser(userId)
    return memberships.map((membership) => membership.organization)
  }

  private repo(): Repository<OrganizationMembership> {
    return this.transactionService.getManager().getRepository(OrganizationMembership)
  }

  private toModel(entity: OrganizationMembership): OrganizationMembershipModel {
    return {
      id: entity.id,
      userId: entity.userId,
      organizationId: entity.organizationId,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      user: entity.user,
      organization: entity.organization,
    }
  }
}
