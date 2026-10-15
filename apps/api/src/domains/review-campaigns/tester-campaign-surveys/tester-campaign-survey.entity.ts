import { Column, JoinColumn, ManyToOne, type Relation, Unique } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { User } from "@/domains/users/user.entity"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAnswer } from "../review-campaigns.types"

@ConnectEntity("tester_campaign_survey", "campaignId", "userId")
@Unique(["campaignId", "userId"])
export class TesterCampaignSurvey extends ConnectEntityBase {
  @Column({ type: "uuid", name: "campaign_id" })
  campaignId!: string

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.testerCampaignSurveys,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "campaign_id" })
  campaign!: Relation<ReviewCampaign>

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @ManyToOne(
    () => User,
    (user) => user.testerCampaignSurveys,
  )
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>

  @Column({ type: "smallint", name: "overall_rating" })
  overallRating!: number

  @Column({ type: "text", nullable: true })
  comment!: string | null

  @Column({ type: "jsonb" })
  answers!: ReviewCampaignAnswer[]

  @Column({ type: "timestamp", name: "submitted_at" })
  submittedAt!: Date
}
