import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { Project } from "@/domains/projects/project.entity"
import { AgentSessionCategory } from "./agent-session-category.entity"

@Entity("project_session_category")
@Unique(["projectId", "name"])
export class ProjectSessionCategory extends Base4AllEntity {
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar" })
  name!: string

  @ManyToOne(
    () => Project,
    (project) => project.projectSessionCategories,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "project_id" })
  project!: Project

  @OneToMany(
    () => AgentSessionCategory,
    (agentSessionCategory) => agentSessionCategory.projectSessionCategory,
  )
  agentSessionCategories!: AgentSessionCategory[]

  @OneToMany(
    () => ConversationAgentSessionCategory,
    (conversationAgentSessionCategory) => conversationAgentSessionCategory.projectSessionCategory,
  )
  conversationSessionCategories!: ConversationAgentSessionCategory[]
}
