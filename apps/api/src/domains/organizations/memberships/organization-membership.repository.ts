import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  getMembershipResourceId,
  UserMembership,
} from "@/domains/memberships/user-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import type { OrganizationMembershipModel } from "./organization-membership.model"
import type { OrganizationMembershipRole } from "./organization-membership.types"
import { resolveOrganizationRoleId } from "@/domains/rbac/resolve-organization-role-id"

const ORGANIZATION_RESOURCE_TYPE = "organization" as const

/**
 * Repository for organization memberships.
 *
 * Reads and writes the unified `user_membership` table with
 * `resourceType = 'organization'`.
 */
@Injectable()
export class OrganizationMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByUserAndOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<OrganizationMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        userId,
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: organizationId,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const organization = await this.organizationRepo().findOne({
      where: { id: organizationId },
    })
    if (!organization) return null

    return this.toModel(membership, organization)
  }

  async findAllByUser(userId: string): Promise<OrganizationMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: ORGANIZATION_RESOURCE_TYPE },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAdminAndOwnerByUser(userId: string): Promise<OrganizationMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: [
        { userId, resourceType: ORGANIZATION_RESOURCE_TYPE, role: "admin" },
        { userId, resourceType: ORGANIZATION_RESOURCE_TYPE, role: "owner" },
      ],
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findAllByOrganization(organizationId: string): Promise<OrganizationMembershipModel[]> {
    const memberships = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .where("membership.resourceType = :resourceType", {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
      })
      .andWhere("membership.resourceId = :organizationId", { organizationId })
      .orderBy("LOWER(user.email)", "ASC")
      .getMany()

    const organization = await this.organizationRepo().findOneOrFail({
      where: { id: organizationId },
    })
    return memberships.map((membership) => this.toModel(membership, organization))
  }

  async findAllByOrganizationIds(
    organizationIds: string[],
  ): Promise<OrganizationMembershipModel[]> {
    if (organizationIds.length === 0) return []

    const memberships = await this.userMembershipRepo().find({
      where: {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: In(organizationIds),
      },
      relations: ["user"],
    })
    return this.toModels(memberships)
  }

  async findOwnerByUserAndOrganizationName({
    userId,
    organizationName,
  }: {
    userId: string
    organizationName: string
  }): Promise<OrganizationMembershipModel | null> {
    const membership = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .innerJoin(Organization, "organization", "organization.id = membership.resource_id")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
      })
      .andWhere("membership.role = :role", { role: "owner" })
      .andWhere("LOWER(organization.name) = LOWER(:organizationName)", { organizationName })
      .getOne()
    if (!membership?.resourceId) return null

    const organization = await this.organizationRepo().findOneOrFail({
      where: { id: membership.resourceId },
    })
    return this.toModel(membership, organization)
  }

  async createMembership({
    userId,
    organizationId,
    role,
  }: {
    userId: string
    organizationId: string
    role: OrganizationMembershipRole
  }): Promise<OrganizationMembershipModel> {
    const manager = this.transactionService.getManager()
    const roleId = await resolveOrganizationRoleId(manager, role)
    const saved = await this.userMembershipRepo().save(
      this.userMembershipRepo().create({
        userId,
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: organizationId,
        role,
        roleId,
      }),
    )
    const withUser = await this.userMembershipRepo().findOneOrFail({
      where: { id: saved.id },
      relations: ["user"],
    })
    const organization = await this.organizationRepo().findOneOrFail({
      where: { id: organizationId },
    })
    return this.toModel(withUser, organization)
  }

  async updateRole({
    membershipId,
    organizationId,
    role,
  }: {
    membershipId: string
    userId: string
    organizationId: string
    role: OrganizationMembershipRole
  }): Promise<void> {
    const manager = this.transactionService.getManager()
    const roleId = await resolveOrganizationRoleId(manager, role)
    await this.userMembershipRepo().update(
      {
        id: membershipId,
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: organizationId,
      },
      { role, roleId },
    )
  }

  async deleteMembership({
    membershipId,
    organizationId,
    userId,
  }: {
    membershipId: string
    organizationId: string
    userId: string
  }): Promise<void> {
    await this.userMembershipRepo().delete({
      id: membershipId,
      userId,
      resourceType: ORGANIZATION_RESOURCE_TYPE,
      resourceId: organizationId,
    })
  }

  async findOrganizationsForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.findAllByUser(userId)
    return memberships.map((membership) => membership.organization)
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private organizationRepo(): Repository<Organization> {
    return this.transactionService.getManager().getRepository(Organization)
  }

  private async toModels(memberships: UserMembership[]): Promise<OrganizationMembershipModel[]> {
    if (memberships.length === 0) return []

    const organizationIds = [
      ...new Set(
        memberships
          .map((membership) => membership.resourceId)
          .filter((resourceId): resourceId is string => resourceId !== null),
      ),
    ]
    const organizations = await this.organizationRepo().find({
      where: { id: In(organizationIds) },
    })
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization]),
    )

    return memberships.flatMap((membership) => {
      if (!membership.resourceId) {
        return []
      }
      const organization = organizationById.get(membership.resourceId)
      return organization ? [this.toModel(membership, organization)] : []
    })
  }

  private toModel(
    membership: UserMembership,
    organization: Organization,
  ): OrganizationMembershipModel {
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: getMembershipResourceId(membership),
      role: membership.role as OrganizationMembershipRole,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
      user: membership.user,
      organization,
    }
  }
}
