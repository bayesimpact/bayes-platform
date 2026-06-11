import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { Agent } from "../agent.entity"
import { ProjectAgentSessionCategory } from "./project-agent-session-category.entity"

@Entity("agent_session_category")
@Unique(["agentId", "name"])
@Unique(["agentId", "projectAgentSessionCategoryId"])
export class AgentSessionCategory extends Base4AllEntity {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "project_agent_session_category_id", nullable: true })
  projectAgentSessionCategoryId!: string | null

  @Column({ type: "varchar" })
  name!: string

  @ManyToOne(
    () => Agent,
    (agent) => agent.sessionCategories,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @ManyToOne(
    () => ProjectAgentSessionCategory,
    (projectAgentSessionCategory) => projectAgentSessionCategory.agentSessionCategories,
    { onDelete: "CASCADE", nullable: true },
  )
  @JoinColumn({ name: "project_agent_session_category_id" })
  projectAgentSessionCategory!: ProjectAgentSessionCategory | null

  @OneToMany(
    () => ConversationAgentSessionCategory,
    (conversationAgentSessionCategory) => conversationAgentSessionCategory.agentSessionCategory,
  )
  conversationSessionCategories!: ConversationAgentSessionCategory[]
}
