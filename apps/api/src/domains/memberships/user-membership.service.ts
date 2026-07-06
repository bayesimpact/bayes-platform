import { Injectable } from "@nestjs/common"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { UserMembership, type UserMembershipRole } from "./user-membership.entity"

export type { UserMembershipRole }

/**
 * Canonical write service for the unified user_membership table.
 *
 * During the transition period this service is called alongside legacy
 * membership writes (dual-write). Legacy write paths will be removed in the
 * follow-up cleanup PR, after which this becomes the sole write layer.
 *
 * ## Transaction participation
 *
 * Each method accepts an optional `manager?: EntityManager` for backward
 * compatibility with callers that haven't yet been migrated to
 * `TransactionService`. When no explicit manager is provided the method calls
 * `transactionService.getManager()`, which returns the transactional manager
 * stored in the current `AsyncLocalStorage` context (if any), falling back to
 * the DataSource's auto-commit manager for plain reads.
 *
 * Callers that already use `TransactionService.run()` can drop the `manager`
 * argument entirely — the ambient context is picked up automatically.
 *
 * TODO (cleanup PR): once all callers use `TransactionService`, remove the
 * `manager?` parameter from every method.
 */
@Injectable()
export class UserMembershipService {
  constructor(private readonly transactionService: TransactionService) {}

  async upsertOrganizationMembership(
    params: { userId: string; organizationId: string; role: UserMembershipRole },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await this.upsertNonCampaign(repo, {
      userId: params.userId,
      resourceType: "organization",
      resourceId: params.organizationId,
      role: params.role,
    })
  }

  async upsertProjectMembership(
    params: { userId: string; projectId: string; role: UserMembershipRole },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await this.upsertNonCampaign(repo, {
      userId: params.userId,
      resourceType: "project",
      resourceId: params.projectId,
      role: params.role,
    })
  }

  async upsertAgentMembership(
    params: { userId: string; agentId: string; role: UserMembershipRole },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await this.upsertNonCampaign(repo, {
      userId: params.userId,
      resourceType: "agent",
      resourceId: params.agentId,
      role: params.role,
    })
  }

  async upsertReviewCampaignMembership(
    params: { userId: string; campaignId: string; role: UserMembershipRole },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    const existing = await repo.findOne({
      where: {
        userId: params.userId,
        resourceId: params.campaignId,
        resourceType: "review_campaign",
        role: params.role,
      },
    })
    if (existing) return
    await repo.save(
      repo.create({
        userId: params.userId,
        resourceType: "review_campaign",
        resourceId: params.campaignId,
        role: params.role,
      }),
    )
  }

  async deleteOrganizationMembership(
    params: { userId: string; organizationId: string },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await repo.delete({
      userId: params.userId,
      resourceType: "organization",
      resourceId: params.organizationId,
    })
  }

  async deleteProjectMembership(
    params: { userId: string; projectId: string },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await repo.delete({
      userId: params.userId,
      resourceType: "project",
      resourceId: params.projectId,
    })
  }

  async deleteAgentMembership(
    params: { userId: string; agentId: string },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager)
    await repo.delete({
      userId: params.userId,
      resourceType: "agent",
      resourceId: params.agentId,
    })
  }

  async deleteAgentMembershipsForUser(
    params: { userId: string; agentIds: string[] },
    manager?: EntityManager,
  ): Promise<void> {
    if (params.agentIds.length === 0) return
    const repo = this.repo(manager)
    await repo
      .createQueryBuilder()
      .delete()
      .where(
        '"user_id" = :userId AND "resource_type" = :resourceType AND "resource_id" = ANY(:agentIds)',
        {
          userId: params.userId,
          resourceType: "agent",
          agentIds: params.agentIds,
        },
      )
      .execute()
  }

  private async upsertNonCampaign(
    repo: Repository<UserMembership>,
    params: {
      userId: string
      resourceType: "organization" | "project" | "agent"
      resourceId: string
      role: UserMembershipRole
    },
  ): Promise<void> {
    const existing = await repo.findOne({
      where: {
        userId: params.userId,
        resourceId: params.resourceId,
        resourceType: params.resourceType,
      },
    })
    if (existing) {
      if (existing.role !== params.role) {
        existing.role = params.role
        await repo.save(existing)
      }
      return
    }
    await repo.save(
      repo.create({
        userId: params.userId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        role: params.role,
      }),
    )
  }

  /**
   * Returns the repository scoped to `manager` when explicitly provided
   * (backward-compat callers), or to the ambient transaction context otherwise.
   */
  private repo(manager?: EntityManager): Repository<UserMembership> {
    return (manager ?? this.transactionService.getManager()).getRepository(UserMembership)
  }
}
