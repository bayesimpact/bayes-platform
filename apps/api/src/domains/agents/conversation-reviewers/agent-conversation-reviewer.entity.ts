import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { User } from "@/domains/users/user.entity"

/**
 * The right to read any conversation of one agent from its session id (safety review), granted
 * person by person from the backoffice. Kept out of `user_membership` on purpose: a person holds
 * one membership per agent, and this right adds to it rather than replacing it.
 *
 * Rows are hard-deleted on revoke so the unique pair can be granted again.
 */
@Entity("agent_conversation_reviewer")
@Unique("UQ_agent_conversation_reviewer_user_agent", ["userId", "agentId"])
export class AgentConversationReviewer extends Base4AllEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string
  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  /** The backoffice operator who granted the right. Null once that account is deleted. */
  @Column({ type: "uuid", name: "granted_by_user_id", nullable: true })
  grantedByUserId!: string | null
  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "granted_by_user_id" })
  grantedBy!: User | null
}
