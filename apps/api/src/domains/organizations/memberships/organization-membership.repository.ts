import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  groupMembershipRows,
  type MembershipRowGroup,
  resourceIdOf,
} from "@/domains/memberships/membership-roles"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { requireRoleId } from "@/domains/rbac/resolve-role-id"
import { HUMAN_USER_TYPE_FILTER } from "@/domains/users/service-user.helpers"
import { USER_TYPE_HUMAN } from "@/domains/users/user.types"
import type { OrganizationMembershipModel } from "./organization-membership.model"

const ORGANIZATION_RESOURCE_TYPE = "organization" as const
const MEMBERSHIP_RELATIONS = { user: true, rbacRole: true } as const

/**
 * Repository for organization memberships.
 *
 * Reads and writes the unified `user_membership` table with `resourceType = 'organization'`. A
 * person holds one row per role on an organization; reads group them into one model per person.
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
    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: ORGANIZATION_RESOURCE_TYPE, resourceId: organizationId },
      relations: MEMBERSHIP_RELATIONS,
    })
    const [group] = groupMembershipRows(rows)
    if (!group) return null

    const organization = await this.organizationRepo().findOne({
      where: { id: organizationId },
    })
    if (!organization) return null

    return this.toModel(group, organization)
  }

  async findAllByUser(userId: string): Promise<OrganizationMembershipModel[]> {
    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: ORGANIZATION_RESOURCE_TYPE },
      relations: MEMBERSHIP_RELATIONS,
    })
    const groups = groupMembershipRows(rows).sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )
    return this.toModels(groups)
  }

  async findAllByOrganization(organizationId: string): Promise<OrganizationMembershipModel[]> {
    const rows = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .leftJoinAndSelect("membership.rbacRole", "rbacRole")
      .where("membership.resourceType = :resourceType", {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
      })
      .andWhere("membership.resourceId = :organizationId", { organizationId })
      .andWhere("user.type = :humanUserType", { humanUserType: USER_TYPE_HUMAN })
      .orderBy("LOWER(user.email)", "ASC")
      .getMany()

    const organization = await this.organizationRepo().findOneOrFail({
      where: { id: organizationId },
    })
    return groupMembershipRows(rows).map((group) => this.toModel(group, organization))
  }

  async findAllByOrganizationIds(
    organizationIds: string[],
  ): Promise<OrganizationMembershipModel[]> {
    if (organizationIds.length === 0) return []

    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: In(organizationIds),
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(groupMembershipRows(rows))
  }

  async findOwnerByUserAndOrganizationName({
    userId,
    organizationName,
  }: {
    userId: string
    organizationName: string
  }): Promise<OrganizationMembershipModel | null> {
    const row = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoin("membership.rbacRole", "rbacRole")
      .innerJoin(Organization, "organization", "organization.id = membership.resource_id")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", {
        resourceType: ORGANIZATION_RESOURCE_TYPE,
      })
      .andWhere("rbacRole.key = :roleKey", { roleKey: ORGANIZATION_ROLES.owner })
      .andWhere("LOWER(organization.name) = LOWER(:organizationName)", { organizationName })
      .getOne()
    if (!row?.resourceId) return null

    return this.findByUserAndOrganization({ userId, organizationId: row.resourceId })
  }

  /** Gives the person the role on the organization. Does nothing when they already hold it. */
  async addRole({
    userId,
    organizationId,
    roleKey,
  }: {
    userId: string
    organizationId: string
    roleKey: string
  }): Promise<void> {
    const roleId = await requireRoleId(this.transactionService.getManager(), roleKey)
    await this.userMembershipRepo()
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        resourceType: ORGANIZATION_RESOURCE_TYPE,
        resourceId: organizationId,
        roleId,
      })
      .orIgnore()
      .execute()
  }

  /**
   * Moves the person from one role to another on the organization, keeping the row when they did
   * not hold the new role yet. Does nothing when they do not hold the old one.
   */
  async switchRole({
    userId,
    organizationId,
    fromRoleKey,
    toRoleKey,
  }: {
    userId: string
    organizationId: string
    fromRoleKey: string
    toRoleKey: string
  }): Promise<void> {
    const manager = this.transactionService.getManager()
    const fromRoleId = await requireRoleId(manager, fromRoleKey)
    const toRoleId = await requireRoleId(manager, toRoleKey)
    const where = { userId, resourceType: ORGANIZATION_RESOURCE_TYPE, resourceId: organizationId }

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
    organizationId,
    roleKey,
  }: {
    userId: string
    organizationId: string
    roleKey: string
  }): Promise<OrganizationMembershipModel> {
    await this.addRole({ userId, organizationId, roleKey })
    const membership = await this.findByUserAndOrganization({ userId, organizationId })
    if (!membership) throw new Error(`Organization ${organizationId} not found`)
    return membership
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

  private async toModels(groups: MembershipRowGroup[]): Promise<OrganizationMembershipModel[]> {
    if (groups.length === 0) return []

    const organizationIds = [...new Set(groups.map((group) => resourceIdOf(group)))]
    const organizations = await this.organizationRepo().find({
      where: { id: In(organizationIds) },
    })
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization]),
    )

    return groups.flatMap((group) => {
      const organization = organizationById.get(resourceIdOf(group))
      return organization ? [this.toModel(group, organization)] : []
    })
  }

  private toModel(
    group: MembershipRowGroup,
    organization: Organization,
  ): OrganizationMembershipModel {
    return {
      userId: group.userId,
      organizationId: resourceIdOf(group),
      roles: group.roles,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      user: group.user,
      organization,
    }
  }
}
