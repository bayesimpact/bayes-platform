import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { hasRole } from "@/domains/memberships/membership-roles"
import type { Organization } from "@/domains/organizations/organization.entity"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import type { OrganizationMembershipModel } from "./organization-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipRepository } from "./organization-membership.repository"

@Injectable()
export class OrganizationMembershipsService {
  constructor(
    private readonly organizationMembershipRepository: OrganizationMembershipRepository,
    private readonly transactionService: TransactionService,
  ) {}

  async findOrganizationMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<OrganizationMembershipModel | null> {
    return this.organizationMembershipRepository.findByUserAndOrganization({
      userId,
      organizationId,
    })
  }

  async listOrganizationsForUser(userId: string): Promise<Organization[]> {
    return this.organizationMembershipRepository.findOrganizationsForUser(userId)
  }

  async listMembershipsForUser(userId: string): Promise<OrganizationMembershipModel[]> {
    return this.organizationMembershipRepository.findAllByUser(userId)
  }

  async listOrganizationMemberships(
    organizationId: string,
  ): Promise<OrganizationMembershipModel[]> {
    return this.organizationMembershipRepository.findAllByOrganization(organizationId)
  }

  async listMembershipsByOrganizationIds(
    organizationIds: string[],
  ): Promise<OrganizationMembershipModel[]> {
    return this.organizationMembershipRepository.findAllByOrganizationIds(organizationIds)
  }

  async findOwnerMembershipByOrganizationName({
    userId,
    organizationName,
  }: {
    userId: string
    organizationName: string
  }): Promise<OrganizationMembershipModel | null> {
    return this.organizationMembershipRepository.findOwnerByUserAndOrganizationName({
      userId,
      organizationName,
    })
  }

  async createOrganizationOwnerMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<OrganizationMembershipModel> {
    return this.transactionService.run(() =>
      this.organizationMembershipRepository.createMembership({
        userId,
        organizationId,
        roleKey: ORGANIZATION_ROLES.owner,
      }),
    )
  }

  /**
   * Ensures the user holds `org_admin` or `org_owner` on the organization.
   *
   * - If they already hold one of them, no-op.
   * - If they hold `org_member`, switches it to admin.
   * - Otherwise adds an admin row.
   */
  async upsertOrganizationAdminMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const existing = await this.organizationMembershipRepository.findByUserAndOrganization({
        userId,
        organizationId,
      })

      if (
        existing &&
        (hasRole(existing, ORGANIZATION_ROLES.admin) || hasRole(existing, ORGANIZATION_ROLES.owner))
      ) {
        return
      }

      if (existing && hasRole(existing, ORGANIZATION_ROLES.member)) {
        await this.organizationMembershipRepository.switchRole({
          userId,
          organizationId,
          fromRoleKey: ORGANIZATION_ROLES.member,
          toRoleKey: ORGANIZATION_ROLES.admin,
        })
        return
      }

      await this.organizationMembershipRepository.addRole({
        userId,
        organizationId,
        roleKey: ORGANIZATION_ROLES.admin,
      })
    })
  }

  /**
   * Ensures the user has a role on the organization.
   * No-op when they already hold any.
   */
  async upsertOrganizationMemberMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const existing = await this.organizationMembershipRepository.findByUserAndOrganization({
        userId,
        organizationId,
      })
      if (existing) return

      await this.organizationMembershipRepository.createMembership({
        userId,
        organizationId,
        roleKey: ORGANIZATION_ROLES.member,
      })
    })
  }
}
