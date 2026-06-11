import { Column, JoinColumn, ManyToOne, Unique } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { User } from "@/domains/users/user.entity"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAgentType, ReviewCampaignAnswer } from "../review-campaigns.types"

@ConnectEntity("reviewer_session_review", "campaignId", "sessionId")
@Unique(["sessionId", "reviewerUserId"])
export class ReviewerSessionReview extends ConnectEntityBase {
  @Column({ type: "uuid", name: "campaign_id" })
  campaignId!: string

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.reviewerSessionReviews,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "campaign_id" })
  campaign!: ReviewCampaign

  @Column({ type: "uuid", name: "session_id" })
  sessionId!: string

  @Column({ type: "varchar", name: "agent_type" })
  agentType!: ReviewCampaignAgentType

  @ManyToOne(() => ConversationAgentSession, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: "session_id" })
  conversationAgentSession?: ConversationAgentSession | null

  @ManyToOne(() => ExtractionAgentSession, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: "session_id" })
  extractionAgentSession?: ExtractionAgentSession | null

  @ManyToOne(() => FormAgentSession, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: "session_id" })
  formAgentSession?: FormAgentSession | null

  @Column({ type: "uuid", name: "reviewer_user_id" })
  reviewerUserId!: string

  @ManyToOne(
    () => User,
    (user) => user.reviewerSessionReviews,
  )
  @JoinColumn({ name: "reviewer_user_id" })
  reviewerUser!: User

  @Column({ type: "smallint", name: "overall_rating" })
  overallRating!: number

  @Column({ type: "text", nullable: true })
  comment!: string | null

  @Column({ type: "jsonb" })
  answers!: ReviewCampaignAnswer[]

  @Column({ type: "timestamp", name: "submitted_at" })
  submittedAt!: Date
}
