import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import { OrganizationMembership } from "./organization-membership.entity"

@Injectable()
export class OrganizationMembershipService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  /**
   * Finds a user membership for a given user and organization.
   */
  async findOrganizationMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<OrganizationMembership | null> {
    return this.repo().findOne({ where: { userId, organizationId } })
  }

  /**
   * Ensures the user has an admin (or higher) organization membership.
   *
   * - If they are already admin or owner, no-op.
   * - If they are a member, promotes them to admin.
   * - If they have no membership, creates an admin one.
   *
   * Dual-writes to the unified `user_membership` table. Participates in any
   * active TransactionService.run() context.
   */
  async upsertOrganizationAdminMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const existing = await this.repo().findOne({ where: { userId, organizationId } })

      if (existing?.role === "admin" || existing?.role === "owner") return

      if (existing) {
        existing.role = "admin"
        await this.repo().save(existing)
        await this.userMembershipRepository.upsertMembership({
          userId,
          resourceType: "organization",
          resourceId: organizationId,
          role: "admin",
        })
        return
      }

      await this.repo().save(this.repo().create({ userId, organizationId, role: "admin" }))
      await this.userMembershipRepository.upsertMembership({
        userId,
        resourceType: "organization",
        resourceId: organizationId,
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
      const existing = await this.repo().findOne({ where: { userId, organizationId } })
      if (existing) return

      await this.repo().save(this.repo().create({ userId, organizationId, role: "member" }))
      await this.userMembershipRepository.upsertMembership({
        userId,
        resourceType: "organization",
        resourceId: organizationId,
        role: "member",
      })
    })
  }

  /**
   * Creates an owner organization membership (legacy + unified tables).
   */
  async createOrganizationOwnerMembership({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      await this.repo().save(this.repo().create({ userId, organizationId, role: "owner" }))
      await this.userMembershipRepository.upsertMembership({
        userId,
        resourceType: "organization",
        resourceId: organizationId,
        role: "owner",
      })
    })
  }

  private repo(): Repository<OrganizationMembership> {
    return this.transactionService.getManager().getRepository(OrganizationMembership)
  }
}
