import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { ConversationAgentSession } from "../../conversation-agent-sessions/conversation-agent-session.entity"

export type ConversationFormStatus = "in_progress" | "concluded"

/**
 * One form of one conversation: the answers the fillForm tool has collected
 * so far for one agent of that conversation.
 *
 * Forms belong to the conversation, not to the agent that fills them. A
 * conversation holds one form per agent that collected answers in it, so a
 * parent agent can read what its sub-agents collected and a sub-agent can see
 * what earlier forms already know. The session is a conversation session or a
 * public (embed) session; like `agent_message.session_id` the column has no
 * foreign key so both tables can own forms.
 */
@ConnectEntityWithUniqueIndex("conversation_form", "sessionId", "agentId")
export class ConversationForm extends ConnectEntityBase {
  @Column({ type: "uuid", name: "session_id" })
  sessionId!: string

  @ManyToOne(
    () => ConversationAgentSession,
    (session) => session.forms,
    { onDelete: "CASCADE", nullable: true, createForeignKeyConstraints: false },
  )
  @JoinColumn({ name: "session_id" })
  conversationAgentSession?: ConversationAgentSession

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string
  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  // The settings revision in force at the last write, as on agent_message: it
  // says which version of the form schema produced the state. The state is
  // read with the agent's current revision, like the rest of the session.
  @Column({ type: "uuid", name: "agent_settings_id" })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "varchar", default: "in_progress" })
  status!: ConversationFormStatus

  // The collected answers, keyed by form field. Merged field by field on each
  // fillForm call; a field is never erased by a later unknown value.
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  state!: Record<string, unknown>
}
