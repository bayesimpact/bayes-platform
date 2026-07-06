import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"
import { ReviewCampaignMembership } from "./review-campaign-membership.entity"
import type { ReviewCampaignMembershipModel } from "./review-campaign-membership.model"

/**
 * Repository for review-campaign memberships.
 *
 * Reads from the legacy `review_campaign_membership` table. Writes to both the
 * legacy table and the unified `user_membership` table (dual-write transition).
 *
 * A user may hold both `tester` and `reviewer` roles on the same campaign;
 * each role is a separate row in both tables.
 */
@Injectable()
export class ReviewCampaignMembershipRepository {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  async findById({
    membershipId,
    campaignId,
  }: {
    membershipId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { id: membershipId, campaignId },
      relations: ["user", "campaign"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findByUserCampaignAndRole({
    userId,
    campaignId,
    role,
  }: {
    userId: string
    campaignId: string
    role: ReviewCampaignMembershipRole
  }): Promise<ReviewCampaignMembershipModel | null> {
    const entity = await this.repo().findOne({
      where: { userId, campaignId, role },
      relations: ["user", "campaign"],
    })
    return entity ? this.toModel(entity) : null
  }

  async findAllByCampaign(campaignId: string): Promise<ReviewCampaignMembershipModel[]> {
    const entities = await this.repo().find({
      where: { campaignId },
      relations: ["user", "campaign"],
      order: { createdAt: "ASC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByUser(userId: string): Promise<ReviewCampaignMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId },
      relations: ["user", "campaign"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByUserAndRole({
    userId,
    role,
  }: {
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<ReviewCampaignMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId, role },
      relations: ["campaign"],
      order: { createdAt: "DESC" },
    })
    return entities.map((entity) => this.toModel(entity))
  }

  async findAllByUserAndCampaign({
    userId,
    campaignId,
  }: {
    userId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel[]> {
    const entities = await this.repo().find({
      where: { userId, campaignId },
      relations: ["user", "campaign"],
    })
    return entities.map((entity) => this.toModel(entity))
  }

  /**
   * Accepts an invitation: creates the legacy membership (with acceptedAt) and
   * dual-writes to `user_membership`. Idempotent when the role already exists.
   */
  async acceptMembership({
    campaignId,
    userId,
    role,
    organizationId,
    projectId,
  }: {
    campaignId: string
    userId: string
    role: ReviewCampaignMembershipRole
    organizationId: string
    projectId: string
  }): Promise<ReviewCampaignMembershipModel> {
    const membershipRepo = this.repo()
    const existing = await membershipRepo.findOne({
      where: { campaignId, userId, role },
      relations: ["user", "campaign"],
    })

    if (existing) {
      if (!existing.acceptedAt) {
        existing.acceptedAt = new Date()
        await membershipRepo.save(existing)
      }
      await this.userMembershipRepository.upsertMembership({
        userId,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role,
      })
      return this.toModel(existing)
    }

    const saved = await membershipRepo.save(
      membershipRepo.create({
        organizationId,
        projectId,
        campaignId,
        userId,
        role,
        acceptedAt: new Date(),
      }),
    )
    await this.userMembershipRepository.upsertMembership({
      userId,
      resourceType: "review_campaign",
      resourceId: campaignId,
      role,
    })
    const withRelations = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user", "campaign"],
    })
    return this.toModel(withRelations)
  }

  /**
   * Deletes a membership from both tables. Must include `role` because a user
   * may hold multiple roles on the same campaign.
   */
  async deleteMembership({
    membershipId,
    campaignId,
    userId,
    role,
  }: {
    membershipId: string
    campaignId: string
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<void> {
    const membershipRepo = this.repo()
    await membershipRepo.delete({ id: membershipId, campaignId })
    await this.userMembershipRepository.deleteMembership({
      userId,
      resourceType: "review_campaign",
      resourceId: campaignId,
      role,
    })
  }

  private repo(): Repository<ReviewCampaignMembership> {
    return this.transactionService.getManager().getRepository(ReviewCampaignMembership)
  }

  private toModel(entity: ReviewCampaignMembership): ReviewCampaignMembershipModel {
    return {
      id: entity.id,
      userId: entity.userId,
      campaignId: entity.campaignId,
      organizationId: entity.organizationId,
      projectId: entity.projectId,
      role: entity.role,
      acceptedAt: entity.acceptedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      user: entity.user,
      campaign: entity.campaign,
    }
  }
}
