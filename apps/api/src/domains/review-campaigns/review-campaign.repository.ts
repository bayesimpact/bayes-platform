import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { ReviewCampaign } from "./review-campaign.entity"

@Injectable()
export class ReviewCampaignRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async listWithMemberCounts(
    connectScope: RequiredConnectScope,
  ): Promise<Array<{ campaign: ReviewCampaign; memberCount: number }>> {
    const { entities, raw } = await this.repo()
      .createQueryBuilder("campaign")
      .leftJoin(
        UserMembership,
        "membership",
        "membership.resource_type = 'review_campaign' AND membership.resource_id = campaign.id",
      )
      .where("campaign.organization_id = :organizationId", {
        organizationId: connectScope.organizationId,
      })
      .andWhere("campaign.project_id = :projectId", { projectId: connectScope.projectId })
      .addSelect("COUNT(membership.id)::int", "memberCount")
      .groupBy("campaign.id")
      .orderBy("campaign.created_at", "DESC")
      .getRawAndEntities<{ memberCount: number }>()

    return entities.map((campaign, index) => ({
      campaign,
      memberCount: Number(raw[index]?.memberCount ?? 0),
    }))
  }

  private repo(): Repository<ReviewCampaign> {
    return this.transactionService.getManager().getRepository(ReviewCampaign)
  }
}
