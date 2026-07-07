import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"
import type { ReviewCampaignMembershipModel } from "./review-campaign-membership.model"

const REVIEW_CAMPAIGN_RESOURCE_TYPE = "review_campaign" as const

/**
 * Repository for review-campaign memberships.
 *
 * Reads and writes the unified `user_membership` table with
 * `resourceType = 'review_campaign'`.
 *
 * A user may hold both `tester` and `reviewer` roles on the same campaign;
 * each role is a separate row.
 */
@Injectable()
export class ReviewCampaignMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findById({
    membershipId,
    campaignId,
  }: {
    membershipId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        id: membershipId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const campaign = await this.campaignRepo().findOne({ where: { id: campaignId } })
    if (!campaign) return null

    return this.toModel(membership, campaign)
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
    const membership = await this.userMembershipRepo().findOne({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        role,
      },
      relations: ["user"],
    })
    if (!membership) return null

    const campaign = await this.campaignRepo().findOne({ where: { id: campaignId } })
    if (!campaign) return null

    return this.toModel(membership, campaign)
  }

  async findAllByCampaign(campaignId: string): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE, resourceId: campaignId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    })
    const campaign = await this.campaignRepo().findOneOrFail({ where: { id: campaignId } })
    return memberships.map((membership) => this.toModel(membership, campaign))
  }

  async findAllByUser(userId: string): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE },
      relations: ["user"],
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAllByUserAndRole({
    userId,
    role,
  }: {
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE, role },
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAllByUserAndCampaign({
    userId,
    campaignId,
  }: {
    userId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
      },
      relations: ["user"],
    })
    const campaign = await this.campaignRepo().findOneOrFail({ where: { id: campaignId } })
    return memberships.map((membership) => this.toModel(membership, campaign))
  }

  async acceptMembership({
    campaignId,
    userId,
    role,
    organizationId: _organizationId,
    projectId: _projectId,
  }: {
    campaignId: string
    userId: string
    role: ReviewCampaignMembershipRole
    organizationId: string
    projectId: string
  }): Promise<ReviewCampaignMembershipModel> {
    const membershipRepo = this.userMembershipRepo()
    const existing = await membershipRepo.findOne({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        role,
      },
      relations: ["user"],
    })

    if (existing) {
      const campaign = await this.campaignRepo().findOneOrFail({ where: { id: campaignId } })
      return this.toModel(existing, campaign)
    }

    const saved = await membershipRepo.save(
      membershipRepo.create({
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        role,
      }),
    )
    const withUser = await membershipRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["user"],
    })
    const campaign = await this.campaignRepo().findOneOrFail({ where: { id: campaignId } })
    return this.toModel(withUser, campaign)
  }

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
    await this.userMembershipRepo().delete({
      id: membershipId,
      userId,
      resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
      resourceId: campaignId,
      role,
    })
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private campaignRepo(): Repository<ReviewCampaign> {
    return this.transactionService.getManager().getRepository(ReviewCampaign)
  }

  private async toModels(memberships: UserMembership[]): Promise<ReviewCampaignMembershipModel[]> {
    if (memberships.length === 0) return []

    const campaignIds = [...new Set(memberships.map((membership) => membership.resourceId))]
    const campaigns = await this.campaignRepo().find({ where: { id: In(campaignIds) } })
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

    return memberships.flatMap((membership) => {
      const campaign = campaignById.get(membership.resourceId)
      return campaign ? [this.toModel(membership, campaign)] : []
    })
  }

  private toModel(
    membership: UserMembership,
    campaign: ReviewCampaign,
  ): ReviewCampaignMembershipModel {
    return {
      id: membership.id,
      userId: membership.userId,
      campaignId: membership.resourceId,
      organizationId: campaign.organizationId,
      projectId: campaign.projectId,
      role: membership.role as ReviewCampaignMembershipRole,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
      user: membership.user,
      campaign,
    }
  }
}
