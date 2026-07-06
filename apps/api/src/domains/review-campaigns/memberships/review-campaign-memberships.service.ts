import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserMembershipRepository } from "@/domains/memberships/user-membership.repository"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"
import { ReviewCampaignMembership } from "./review-campaign-membership.entity"

@Injectable()
export class ReviewCampaignMembershipsService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly userMembershipRepository: UserMembershipRepository,
  ) {}

  /**
   * Accepts a review-campaign invitation: creates or updates the legacy membership
   * and dual-writes to `user_membership`.
   */
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
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const repository = this.repo()
      const existing = await repository.findOne({
        where: { campaignId, userId, role },
      })

      if (existing) {
        if (!existing.acceptedAt) {
          existing.acceptedAt = new Date()
          await repository.save(existing)
        }
      } else {
        await repository.save(
          repository.create({
            organizationId,
            projectId,
            campaignId,
            userId,
            role,
            acceptedAt: new Date(),
          }),
        )
      }

      await this.userMembershipRepository.upsertMembership({
        userId,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role,
      })
    })
  }

  private repo(): Repository<ReviewCampaignMembership> {
    return this.transactionService.getManager().getRepository(ReviewCampaignMembership)
  }
}
