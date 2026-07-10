import { Column, Entity, OneToMany } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { ReviewerSessionReview } from "@/domains/review-campaigns/reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "@/domains/review-campaigns/tester-campaign-surveys/tester-campaign-survey.entity"
import { AgentMessageFeedback } from "../agents/shared/agent-session-messages/feedback/agent-message-feedback.entity"

@Entity("user")
export class User extends Base4AllEntity {
  @Column({ type: "varchar", unique: true, name: "auth0_id" })
  auth0Id!: string

  @Column({ type: "varchar" })
  email!: string

  @Column({ type: "varchar", nullable: true })
  name!: string | null

  @Column({ type: "varchar", nullable: true, name: "picture_url" })
  pictureUrl!: string | null

  @OneToMany(
    () => UserMembership,
    (membership) => membership.user,
  )
  userMemberships!: UserMembership[]

  @OneToMany(
    () => ConversationAgentSession,
    (conversationAgentSession) => conversationAgentSession.user,
  )
  conversationAgentSessions!: ConversationAgentSession[]

  @OneToMany(
    () => AgentMessageFeedback,
    (agentMessageFeedback) => agentMessageFeedback.user,
  )
  agentMessageFeedbacks!: AgentMessageFeedback[]

  @OneToMany(
    () => TesterCampaignSurvey,
    (testerCampaignSurvey) => testerCampaignSurvey.user,
  )
  testerCampaignSurveys!: TesterCampaignSurvey[]

  @OneToMany(
    () => ReviewerSessionReview,
    (reviewerSessionReview) => reviewerSessionReview.reviewerUser,
  )
  reviewerSessionReviews!: ReviewerSessionReview[]
}
