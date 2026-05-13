import { Column, JoinColumn, ManyToOne, Unique } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { User } from "@/domains/users/user.entity"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"

@ConnectEntity("review_campaign_membership", "campaignId", "userId")
@Unique(["campaignId", "userId", "role"])
export class ReviewCampaignMembership extends ConnectEntityBase {
  @Column({ type: "uuid", name: "campaign_id" })
  campaignId!: string

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.memberships,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "campaign_id" })
  campaign!: ReviewCampaign

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @ManyToOne(
    () => User,
    (user) => user.reviewCampaignMemberships,
  )
  @JoinColumn({ name: "user_id" })
  user!: User

  @Column({ type: "varchar" })
  role!: ReviewCampaignMembershipRole

  @Column({ type: "timestamp", name: "accepted_at", nullable: true })
  acceptedAt!: Date | null
}
