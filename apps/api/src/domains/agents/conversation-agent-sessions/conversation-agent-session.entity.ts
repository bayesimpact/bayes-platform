import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { User } from "@/domains/users/user.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"
import { ConversationAgentSessionCategory } from "./conversation-agent-session-category.entity"

@ConnectEntity("conversation_agent_session", "agentId", "type")
export class ConversationAgentSession extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "trace_id", nullable: true })
  traceId!: string

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar" })
  type!: BaseAgentSessionType

  @Column({ type: "varchar", nullable: true })
  title!: string | null

  // Form state accumulated by the fillForm tool, when the agent has it enabled.
  @Column({ type: "jsonb", nullable: true })
  result!: Record<string, unknown> | null

  // The parent agent session that spawned this sub-session, if any. Used to
  // find-or-create a single conversation sub-session per parent conversation so
  // the sub-agent's turns land in one persistent trace. Its presence is what
  // marks a session as a sub-session (see {@link isSubSession}).
  @Column({ type: "uuid", name: "parent_session_id", nullable: true })
  parentSessionId!: string | null

  // When set, this session's next turn is handled by this agent instead of its own
  // `agentId` (a "handoff" sub-agent link is currently in control). Null means the
  // session's own root agent is in control, which is the state for every session today.
  // Cleared automatically once the active agent's delegated task is complete (see
  // ConversationAgentSessionsService.updateSessionResult).
  @Column({ type: "uuid", name: "active_agent_id", nullable: true })
  activeAgentId!: string | null

  // True when this conversation session was created on behalf of a parent agent
  // that delegates to this conversation agent as a sub-agent. Derived from
  // parentSessionId so there is no separate column to keep in sync.
  get isSubSession(): boolean {
    return this.parentSessionId != null
  }

  @Column({ type: "timestamp", nullable: true, name: "expires_at" }) // FIXME: to be removed
  expiresAt!: Date | null

  @ManyToOne(
    () => Agent,
    (agent) => agent.conversationAgentSessions,
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @ManyToOne(
    () => User,
    (user) => user.conversationAgentSessions,
  )
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(
    () => Organization,
    (organization) => organization.conversationAgentSessions,
  )
  @JoinColumn({ name: "organization_id" })
  organization!: Organization

  @OneToMany(
    () => AgentMessage,
    (message) => message.conversationAgentSession,
  )
  messages!: AgentMessage[]

  @Column({ type: "uuid", name: "campaign_id", nullable: true })
  campaignId!: string | null

  @ManyToOne(
    () => ReviewCampaign,
    (campaign) => campaign.conversationAgentSessions,
    { nullable: true },
  )
  @JoinColumn({ name: "campaign_id" })
  reviewCampaign?: ReviewCampaign | null

  @OneToMany(
    () => ConversationAgentSessionCategory,
    (conversationAgentSessionCategory) => conversationAgentSessionCategory.conversationAgentSession,
  )
  sessionCategories!: ConversationAgentSessionCategory[]
}
