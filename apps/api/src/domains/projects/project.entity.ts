import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { ProjectAgentSessionCategory } from "@/domains/agents/session-categories/project-agent-session-category.entity"
import { Document } from "@/domains/documents/document.entity"
import { DocumentSource } from "@/domains/documents/sources/document-source.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { AgentMessageFeedback } from "../agents/shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { ReviewCampaign } from "../review-campaigns/review-campaign.entity"

@Entity("project")
export class Project extends Base4AllEntity {
  @Column({ type: "varchar" })
  name!: string

  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  // GDPR retention: conversation content older than this is purged by the
  // retention sweep (rows and metadata are kept for analytics). Defaults to
  // 30 days; always set (1 to 3650) — a workspace that must keep history a
  // long time sets a high value.
  @Column({ type: "int", name: "conversation_retention_days", default: 30 })
  conversationRetentionDays!: number

  @ManyToOne(
    () => Organization,
    (organization) => organization.projects,
  )
  @JoinColumn({ name: "organization_id" })
  organization!: Organization

  @OneToMany(
    () => Agent,
    (agent) => agent.project,
  )
  agents!: Agent[]

  @OneToMany(
    () => ProjectAgentSessionCategory,
    (projectAgentSessionCategory) => projectAgentSessionCategory.project,
  )
  projectAgentSessionCategories!: ProjectAgentSessionCategory[]

  @OneToMany(
    () => Document,
    (document) => document.project,
  )
  documents!: Document[]

  @OneToMany(
    () => DocumentSource,
    (documentSource) => documentSource.project,
  )
  documentSources!: DocumentSource[]

  @OneToMany(
    () => AgentMessageFeedback,
    (agentMessageFeedback) => agentMessageFeedback.project,
  )
  agentMessageFeedbacks!: AgentMessageFeedback[]

  @OneToMany(
    () => FeatureFlag,
    (featureFlag) => featureFlag.project,
  )
  featureFlags!: FeatureFlag[]

  @OneToMany(
    () => ReviewCampaign,
    (reviewCampaign) => reviewCampaign.project,
  )
  reviewCampaigns!: ReviewCampaign[]
}
