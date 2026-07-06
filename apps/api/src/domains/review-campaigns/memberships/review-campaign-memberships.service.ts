import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"
import type { ReviewCampaignMembershipModel } from "./review-campaign-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipRepository } from "./review-campaign-membership.repository"

@Injectable()
export class ReviewCampaignMembershipsService {
  constructor(
    private readonly reviewCampaignMembershipRepository: ReviewCampaignMembershipRepository,
    private readonly transactionService: TransactionService,
  ) {}

  async findById({
    membershipId,
    campaignId,
  }: {
    membershipId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel | null> {
    return this.reviewCampaignMembershipRepository.findById({ membershipId, campaignId })
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
    return this.reviewCampaignMembershipRepository.findByUserCampaignAndRole({
      userId,
      campaignId,
      role,
    })
  }

  async listCampaignMemberships(campaignId: string): Promise<ReviewCampaignMembershipModel[]> {
    return this.reviewCampaignMembershipRepository.findAllByCampaign(campaignId)
  }

  async listMembershipsForUser(userId: string): Promise<ReviewCampaignMembershipModel[]> {
    return this.reviewCampaignMembershipRepository.findAllByUser(userId)
  }

  async listCampaignsForUser(
    userId: string,
    role: ReviewCampaignMembershipRole,
  ): Promise<ReviewCampaign[]> {
    const memberships = await this.reviewCampaignMembershipRepository.findAllByUserAndRole({
      userId,
      role,
    })
    return memberships
      .map((membership) => membership.campaign)
      .filter((campaign): campaign is ReviewCampaign => {
        if (!campaign) return false
        if (role === "reviewer") return campaign.status !== "draft"
        return campaign.status === "active"
      })
  }

  async acceptCampaignMembership({
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
    return this.transactionService.run(() =>
      this.reviewCampaignMembershipRepository.acceptMembership({
        campaignId,
        userId,
        role,
        organizationId,
        projectId,
      }),
    )
  }

  async removeCampaignMembership({
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
    return this.transactionService.run(() =>
      this.reviewCampaignMembershipRepository.deleteMembership({
        membershipId,
        campaignId,
        userId,
        role,
      }),
    )
  }
}
