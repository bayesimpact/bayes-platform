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

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent
}
