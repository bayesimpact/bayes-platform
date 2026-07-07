import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { Organization } from "@/domains/organizations/organization.entity"
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

  async listAdminAndOwnerMembershipsForUser(
    userId: string,
  ): Promise<OrganizationMembershipModel[]> {
    return this.organizationMembershipRepository.findAdminAndOwnerByUser(userId)
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
        role: "owner",
      }),
    )
  }

  /**
   * Ensures the user has an admin (or higher) organization membership.
   *
   * - If they are already admin or owner, no-op.
   * - If they are a member, promotes them to admin.
   * - If they have no membership, creates an admin one.
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

      if (existing?.role === "admin" || existing?.role === "owner") return

      if (existing) {
        await this.organizationMembershipRepository.updateRole({
          membershipId: existing.id,
          userId,
          organizationId,
          role: "admin",
        })
        return
      }

      await this.organizationMembershipRepository.createMembership({
        userId,
        organizationId,
        role: "admin",
      })
    })
  }

  /**
   * Ensures the user has a member-level organization membership.
   * No-op when any membership already exists.
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
        role: "member",
      })
    })
  }
}
