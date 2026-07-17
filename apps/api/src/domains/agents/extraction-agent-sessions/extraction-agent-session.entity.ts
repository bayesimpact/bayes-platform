import type { ExtractionAgentSessionStatus } from "@caseai-connect/api-contracts"
import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { Document } from "@/domains/documents/document.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { User } from "@/domains/users/user.entity"
import { Agent } from "../agent.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"

@ConnectEntity("extraction_agent_session", "agentSettingsId", "createdAt")
export class ExtractionAgentSession extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "uuid", name: "agent_settings_id", nullable: false })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "uuid", name: "document_id" })
  documentId!: string

  @Column({ type: "varchar" })
  status!: ExtractionAgentSessionStatus

  @Column({ type: "varchar" })
  type!: BaseAgentSessionType

  @Column({ type: "jsonb", nullable: true })
  result!: Record<string, unknown> | null

  @Column({ type: "varchar", nullable: true, name: "error_code" })
  errorCode!: string | null

  @Column({ type: "jsonb", nullable: true, name: "error_details" })
  errorDetails!: Record<string, unknown> | null

  @Column({ type: "text", name: "effective_prompt" })
  effectivePrompt!: string

  @Column({ type: "uuid", name: "trace_id" })
  traceId!: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(() => Document)
  @JoinColumn({ name: "document_id" })
  document!: Document

  @Column({ type: "uuid", name: "campaign_id", nullable: true })
  campaignId!: string | null

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.extractionAgentSessions,
    { nullable: true },
  )
  @JoinColumn({ name: "campaign_id" })
  reviewCampaign?: ReviewCampaign | null
}
