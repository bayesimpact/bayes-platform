import { Column, JoinColumn, ManyToOne, Unique } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAgentType, ReviewCampaignAnswer } from "../review-campaigns.types"

@ConnectEntity("tester_session_feedback", "campaignId", "sessionId")
@Unique(["sessionId"])
export class TesterSessionFeedback extends ConnectEntityBase {
  @Column({ type: "uuid", name: "campaign_id" })
  campaignId!: string

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.testerSessionFeedbacks,
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

  @Column({ type: "smallint", name: "overall_rating" })
  overallRating!: number

  @Column({ type: "text", nullable: true })
  comment!: string | null

  @Column({ type: "jsonb" })
  answers!: ReviewCampaignAnswer[]
}
