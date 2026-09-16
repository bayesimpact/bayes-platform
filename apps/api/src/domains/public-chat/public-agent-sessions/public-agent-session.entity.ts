import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSessionCategory } from "./public-agent-session-category.entity"

@Entity("public_agent_session")
@Index(["sessionTokenHash"])
export class PublicAgentSession extends Base4AllEntity {
  @Column({ type: "uuid", name: "embed_config_id" })
  embedConfigId!: string

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar", name: "session_token_hash", unique: true })
  sessionTokenHash!: string

  @Column({ type: "varchar", name: "external_visitor_id", nullable: true })
  externalVisitorId!: string | null

  @Column({ type: "timestamp", name: "last_activity_at", nullable: true })
  lastActivityAt!: Date | null

  /** Session title produced by the post-turn classification. */
  @Column({ type: "varchar", name: "title", nullable: true })
  title!: string | null

  /** fillForm accumulated state, mirroring conversation_agent_session.result. */
  @Column({ type: "jsonb", name: "result", nullable: true })
  result!: Record<string, unknown> | null

  // Set when the retention sweep purged this session's content (GDPR). The
  // session and message rows survive for analytics; content fields are emptied
  // and externalVisitorId is cleared so no link to a person remains.
  @Column({ type: "timestamp", nullable: true, name: "purged_at" })
  purgedAt!: Date | null

  @OneToMany(
    () => PublicAgentSessionCategory,
    (sessionCategory) => sessionCategory.publicAgentSession,
  )
  sessionCategories!: PublicAgentSessionCategory[]

  @ManyToOne(() => AgentEmbedConfig, { onDelete: "CASCADE" })
  @JoinColumn({ name: "embed_config_id" })
  embedConfig!: AgentEmbedConfig
}
