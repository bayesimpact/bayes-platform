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
import { ProjectAgentSessionCategory } from "@/domains/agents/session-categories/project-agent-session-category.entity"
import { ConversationAgentSession } from "./conversation-agent-session.entity"

@Entity("conversation_agent_session_category")
@Unique(["conversationAgentSessionId", "agentSessionCategoryId"])
export class ConversationAgentSessionCategory {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "uuid", name: "conversation_agent_session_id" })
  conversationAgentSessionId!: string

  @Column({ type: "uuid", name: "agent_session_category_id" })
  agentSessionCategoryId!: string

  @Column({ type: "uuid", name: "project_agent_session_category_id", nullable: true })
  projectAgentSessionCategoryId!: string | null

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date

  @ManyToOne(
    () => ConversationAgentSession,
    (conversationAgentSession) => conversationAgentSession.sessionCategories,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "conversation_agent_session_id" })
  conversationAgentSession!: ConversationAgentSession

  @ManyToOne(
    () => AgentSessionCategory,
    (agentSessionCategory) => agentSessionCategory.conversationSessionCategories,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "agent_session_category_id" })
  agentSessionCategory!: AgentSessionCategory

  @ManyToOne(
    () => ProjectAgentSessionCategory,
    (projectAgentSessionCategory) => projectAgentSessionCategory.conversationSessionCategories,
    { onDelete: "CASCADE", nullable: true },
  )
  @JoinColumn({ name: "project_agent_session_category_id" })
  projectAgentSessionCategory!: ProjectAgentSessionCategory | null
}
