import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { PublicAgentSession } from "./public-agent-session.entity"

/**
 * Categories attached to a PUBLIC (embed) session by the post-turn
 * classification (see turn-classification.ts).
 * embed sessions can enter the same category analytics.
 */
@Entity("public_agent_session_category")
@Unique(["publicAgentSessionId", "agentSessionCategoryId"])
export class PublicAgentSessionCategory {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "uuid", name: "public_agent_session_id" })
  publicAgentSessionId!: string

  @Column({ type: "uuid", name: "agent_session_category_id" })
  agentSessionCategoryId!: string

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date

  @ManyToOne(
    () => PublicAgentSession,
    (publicAgentSession) => publicAgentSession.sessionCategories,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "public_agent_session_id" })
  publicAgentSession!: PublicAgentSession

  @ManyToOne(() => AgentSessionCategory, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_session_category_id" })
  agentSessionCategory!: AgentSessionCategory
}
