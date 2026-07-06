import { Injectable } from "@nestjs/common"
import type { EntityManager, Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  UserMembership,
  type UserMembershipResourceType,
  type UserMembershipRole,
} from "./user-membership.entity"

export type UpsertMembershipParams = {
  userId: string
  resourceType: UserMembershipResourceType
  resourceId: string
  role: UserMembershipRole
}

export type DeleteMembershipParams = {
  userId: string
  resourceType: UserMembershipResourceType
  resourceId: string
  /** When set, targets a single role row (required for review_campaign). */
  role?: UserMembershipRole
}

export type DeleteMembershipsForUserParams = {
  userId: string
  resourceType: UserMembershipResourceType
  resourceIds: string[]
}

/**
 * Persistence layer for the unified `user_membership` table.
 *
 * Callers pass `resourceType` and `resourceId` — this repository does not
 * know about organization/project/agent/campaign domains.
 *
 * Participates in the ambient transaction via TransactionService.getManager()
 * when no explicit manager is supplied.
 */
@Injectable()
export class UserMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async upsertMembership(params: UpsertMembershipParams, manager?: EntityManager): Promise<void> {
    if (params.resourceType === "review_campaign") {
      await this.upsertReviewCampaignMembership(this.repo(manager), params)
      return
    }
    await this.upsertNonCampaignMembership(this.repo(manager), params)
  }

  async deleteMembership(params: DeleteMembershipParams, manager?: EntityManager): Promise<void> {
    const where: {
      userId: string
      resourceType: UserMembershipResourceType
      resourceId: string
      role?: UserMembershipRole
    } = {
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
    }
    if (params.role !== undefined) {
      where.role = params.role
    }
    await this.repo(manager).delete(where)
  }

  async deleteMembershipsForUser(
    params: DeleteMembershipsForUserParams,
    manager?: EntityManager,
  ): Promise<void> {
    if (params.resourceIds.length === 0) return

    await this.repo(manager)
      .createQueryBuilder()
      .delete()
      .where(
        '"user_id" = :userId AND "resource_type" = :resourceType AND "resource_id" = ANY(:resourceIds)',
        {
          userId: params.userId,
          resourceType: params.resourceType,
          resourceIds: params.resourceIds,
        },
      )
      .execute()
  }

  private async upsertNonCampaignMembership(
    repo: Repository<UserMembership>,
    params: UpsertMembershipParams,
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

  private async upsertReviewCampaignMembership(
    repo: Repository<UserMembership>,
    params: UpsertMembershipParams,
  ): Promise<void> {
    const existing = await repo.findOne({
      where: {
        userId: params.userId,
        resourceId: params.resourceId,
        resourceType: params.resourceType,
        role: params.role,
      },
    })
    if (existing) return
    await repo.save(
      repo.create({
        userId: params.userId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        role: params.role,
      }),
    )
  }

  private repo(manager?: EntityManager): Repository<UserMembership> {
    return (manager ?? this.transactionService.getManager()).getRepository(UserMembership)
  }
}
