import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type EntityManager } from "typeorm"
import { UserMembership, type UserMembershipRole } from "./user-membership.entity"

export type { UserMembershipRole }

/**
 * Canonical write service for the unified user_membership table.
 *
 * During the transition period this service is called alongside legacy
 * membership writes (dual-write). Legacy write paths will be removed in the
 * follow-up cleanup PR, after which this becomes the sole write layer.
 */
@Injectable()
export class UserMembershipService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Upsert a row in user_membership from a transaction-scoped EntityManager.
   * Prefer the manager-based overload when inside a TypeORM transaction so the
   * write participates in the same transaction as the legacy table write.
   *
   * TODO (cleanup PR): once the legacy membership tables are dropped, remove the
   * `manager?` parameter from all upsert/delete methods. Callers will no longer
   * need to co-ordinate dual-write atomicity; transactions will be owned at the
   * service or use-case level instead.
   */
  async upsertOrganizationMembership(
    params: { userId: string; organizationId: string; role: UserMembershipRole },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    const repo = (manager ?? this.dataSource.manager).getRepository(UserMembership)
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
    repo: ReturnType<typeof this.dataSource.manager.getRepository<UserMembership>>,
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
}
