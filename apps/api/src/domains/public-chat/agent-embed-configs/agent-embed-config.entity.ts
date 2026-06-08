import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"

@ConnectEntity("agent_embed_config", "agentId")
export class AgentEmbedConfig extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id", unique: true })
  agentId!: string

  @Column({ type: "uuid", name: "embed_token", unique: true })
  embedToken!: string

  @Column({ type: "boolean", name: "is_enabled", default: false })
  isEnabled!: boolean

  @Column({ type: "jsonb", name: "allowed_origins", default: [] })
  allowedOrigins!: string[]

  @Column({ type: "text", name: "title", nullable: true, default: null })
  title!: string | null

  @Column({ type: "text", name: "logo_url", nullable: true, default: null })
  logoUrl!: string | null

  @Column({ type: "varchar", name: "primary_color", length: 20, nullable: true, default: null })
  primaryColor!: string | null

  @Column({ type: "varchar", name: "display_mode", length: 20, default: "modal" })
  displayMode!: "modal" | "drawer"

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent
}
