import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"

@ConnectEntity("form_agent_session", "agentId", "type")
export class FormAgentSession extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "trace_id", nullable: true })
  traceId!: string

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar" })
  type!: BaseAgentSessionType

  @Column({ type: "jsonb", nullable: true })
  result!: Record<string, unknown> | null

  // The parent agent session that spawned this sub-session, if any. Used to
  // find-or-create a single sub form session per parent conversation so the
  // form state accumulates across turns. Its presence is what marks a session as
  // a sub-session (see {@link isSubSession}).
  @Column({ type: "uuid", name: "parent_session_id", nullable: true })
  parentSessionId!: string | null

  // True when this form session was created on behalf of a parent agent that
  // delegates to this form agent as a sub-agent. Derived from parentSessionId so
  // there is no separate column to keep in sync.
  get isSubSession(): boolean {
    return this.parentSessionId != null
  }

  @OneToMany(
    () => AgentMessage,
    (message) => message.formAgentSession,
  )
  messages!: AgentMessage[]

  @Column({ type: "uuid", name: "campaign_id", nullable: true })
  campaignId!: string | null

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.formAgentSessions,
    { nullable: true },
  )
  @JoinColumn({ name: "campaign_id" })
  reviewCampaign?: ReviewCampaign | null
}
