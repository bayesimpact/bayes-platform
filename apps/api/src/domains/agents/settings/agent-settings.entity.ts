import type {
  AgentLocale,
  AgentModel,
  AgentTemperature,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"

@ConnectEntityWithUniqueIndex("agent_settings", "agentId", "revision")
export class AgentSettings extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id", nullable: false })
  agentId!: string

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "integer", nullable: false })
  revision!: number

  @Column({ type: "text", name: "instructions", nullable: false })
  instructions!: string

  @Column({ type: "varchar", nullable: false })
  model!: AgentModel

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0,
    nullable: false,
    // Postgres returns `decimal` as a string; convert on read so the runtime value matches the
    // declared number type (AgentDto.temperature) and passes numeric validation.
    transformer: {
      from: (value: string | null): AgentTemperature => (value === null ? 0 : Number(value)),
      to: (value: AgentTemperature): AgentTemperature => value,
    },
  })
  temperature!: AgentTemperature

  @Column({ type: "varchar", nullable: false })
  locale!: AgentLocale

  @Column({ type: "varchar", name: "documents_rag_mode", default: "all", nullable: false })
  documentsRagMode!: DocumentsRagMode

  @Column({ type: "text", nullable: true, name: "greeting_message" })
  greetingMessage!: string | null

  @Column({ type: "jsonb", nullable: true, name: "output_json_schema" })
  outputJsonSchema!: Record<string, unknown> | null

  @Column({ type: "boolean", name: "fill_form_enabled", default: false, nullable: false })
  fillFormEnabled!: boolean
}
