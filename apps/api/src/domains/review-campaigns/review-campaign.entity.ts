import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { Project } from "@/domains/projects/project.entity"
import type { ReviewCampaignQuestion, ReviewCampaignStatus } from "./review-campaigns.types"
import { ReviewerSessionReview } from "./reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "./tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "./tester-session-feedbacks/tester-session-feedback.entity"

@ConnectEntity("review_campaign", "agentId")
export class ReviewCampaign extends ConnectEntityBase {
  @ManyToOne(
    () => Project,
    (project) => project.reviewCampaigns,
  )
  @JoinColumn({ name: "project_id" })
  project!: Project

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @ManyToOne(
    () => Agent,
    (agent) => agent.reviewCampaigns,
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "varchar" })
  name!: string

  @Column({ type: "text", nullable: true })
  description!: string | null

  @Column({ type: "varchar", default: "draft" })
  status!: ReviewCampaignStatus

  @Column({ type: "jsonb", name: "tester_per_session_questions" })
  testerPerSessionQuestions!: ReviewCampaignQuestion[]

  @Column({ type: "jsonb", name: "tester_end_of_phase_questions" })
  testerEndOfPhaseQuestions!: ReviewCampaignQuestion[]

  @Column({ type: "jsonb", name: "reviewer_questions" })
  reviewerQuestions!: ReviewCampaignQuestion[]

  @Column({ type: "timestamp", name: "activated_at", nullable: true })
  activatedAt!: Date | null

  @Column({ type: "timestamp", name: "closed_at", nullable: true })
  closedAt!: Date | null

  @OneToMany(
    () => TesterSessionFeedback,
    (feedback) => feedback.campaign,
  )
  testerSessionFeedbacks!: TesterSessionFeedback[]

  @OneToMany(
    () => TesterCampaignSurvey,
    (survey) => survey.campaign,
  )
  testerCampaignSurveys!: TesterCampaignSurvey[]

  @OneToMany(
    () => ReviewerSessionReview,
    (review) => review.campaign,
  )
  reviewerSessionReviews!: ReviewerSessionReview[]

  @OneToMany(
    () => ConversationAgentSession,
    (session) => session.reviewCampaign,
  )
  conversationAgentSessions!: ConversationAgentSession[]

  @OneToMany(
    () => ExtractionAgentSession,
    (session) => session.reviewCampaign,
  )
  extractionAgentSessions!: ExtractionAgentSession[]

  @OneToMany(
    () => FormAgentSession,
    (session) => session.reviewCampaign,
  )
  formAgentSessions!: FormAgentSession[]
}
