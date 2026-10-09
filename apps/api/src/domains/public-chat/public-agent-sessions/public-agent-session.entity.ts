import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { AppInstallation } from "@/domains/apps/app-installation.entity"
import { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSessionCategory } from "./public-agent-session-category.entity"

/**
 * A conversation with an agent for someone who is not signed in. It comes either
 * from the embed (`embedConfigId`, with a session token) or from an installed App
 * (`appInstallationId`, no session token: the App authenticates every call).
 */
@Entity("public_agent_session")
@Index(["sessionTokenHash"])
@Index(["appInstallationId"])
@Check(
  "CHK_public_agent_session_one_channel",
  '("embed_config_id" IS NULL) <> ("app_installation_id" IS NULL)',
)
export class PublicAgentSession extends Base4AllEntity {
  @Column({ type: "uuid", name: "embed_config_id", nullable: true })
  embedConfigId!: string | null

  @Column({ type: "uuid", name: "app_installation_id", nullable: true })
  appInstallationId!: string | null

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar", name: "session_token_hash", unique: true, nullable: true })
  sessionTokenHash!: string | null

  @Column({ type: "varchar", name: "external_visitor_id", nullable: true })
  externalVisitorId!: string | null

  @Column({ type: "timestamp", name: "last_activity_at", nullable: true })
  lastActivityAt!: Date | null

  /** Session title produced by the post-turn classification. */
  @Column({ type: "varchar", name: "title", nullable: true })
  title!: string | null

  /** The sub-agent in control while a handoff is in progress (see ConversationAgentSession). */
  @Column({ type: "uuid", name: "active_agent_id", nullable: true })
  activeAgentId!: string | null

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
  embedConfig?: AgentEmbedConfig | null

  @ManyToOne(() => AppInstallation)
  @JoinColumn({ name: "app_installation_id" })
  appInstallation?: AppInstallation | null
}
