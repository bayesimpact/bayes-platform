import type {
  AgentMemoryMode,
  AgentModel,
  DocumentsRagMode,
  EmbeddingModel,
} from "@bayes-platform/api-contracts"
import { Column, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"

@ConnectEntityWithUniqueIndex("agent_settings", "agentId", "revision")
// At most one revision of an agent is in production.
@Index("UQ_agent_settings_production", ["agentId"], {
  unique: true,
  where: '"is_production" = true AND "deleted_at" IS NULL',
})
export class AgentSettings extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id", nullable: false })
  agentId!: string

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Relation<Agent>

  @Column({ type: "integer", nullable: false })
  revision!: number

  @Column({ type: "text", name: "revision_name", nullable: true })
  revisionName?: string

  @Column({ type: "text", name: "revision_desc", nullable: true })
  revisionDesc?: string

  @Column({ type: "boolean", name: "is_draft", default: false })
  isDraft!: boolean

  @Column({ type: "boolean", name: "is_archived", default: false })
  isArchived!: boolean

  /**
   * The saved revision every live channel runs with (the Desk, public chat, review campaigns,
   * sub-agent calls). Managers choose it; it is never the draft nor an archived revision. The
   * first saved revision of an agent goes to production by itself.
   */
  @Column({ type: "boolean", name: "is_production", default: false })
  isProduction!: boolean

  @Column({ type: "text", name: "instructions", nullable: false })
  instructions!: string

  // Defaults of the {{variables}} the instructions declare: the fallback every
  // channel uses when it starts a session without a value for one of them.
  @Column({ type: "jsonb", name: "variables", nullable: true, default: null })
  variables!: Record<string, string> | null

  @Column({ type: "varchar", nullable: false })
  model!: AgentModel

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0,
    name: "temperature",
    nullable: false,
    // Postgres returns `decimal` as a string; convert on read so the runtime value matches the
    // declared number type (AgentDto.temperature) and passes numeric validation.
    transformer: {
      from: (value: string | null): number => (value === null ? 0 : Number(value)),
      to: (value: number): number => value,
    },
  })
  deletedTemperature!: number

  @Column({ type: "varchar", name: "documents_rag_mode", default: "all", nullable: false })
  documentsRagMode!: DocumentsRagMode

  /**
   * The model the knowledge base lookup embeds the query with, one of its project's. Always a
   * real name, never "the default": a project changing its default must not move existing agents.
   * A new agent takes the project's default.
   */
  @Column({ type: "varchar", name: "embedding_model", nullable: false })
  embeddingModel!: EmbeddingModel

  @Column({ type: "text", nullable: true, name: "greeting_message" })
  greetingMessage!: string | null

  @Column({ type: "jsonb", nullable: true, name: "output_json_schema" })
  outputJsonSchema!: Record<string, unknown> | null

  @Column({ type: "boolean", name: "fill_form_enabled", default: false, nullable: false })
  fillFormEnabled!: boolean

  @Column({ type: "boolean", name: "priority_calls_enabled", default: false, nullable: false })
  priorityCallsEnabled!: boolean

  @Column({ type: "jsonb", nullable: false, name: "provider_options" })
  providerOptions!: Record<string, unknown>

  @Column({ type: "varchar", name: "memory_mode", nullable: false, default: "off" })
  memoryMode!: AgentMemoryMode

  @Column({
    type: "boolean",
    name: "follow_up_suggestions_enabled",
    default: false,
    nullable: false,
  })
  followUpSuggestionsEnabled!: boolean

  @Column({ type: "text", name: "follow_up_suggestions_instructions", nullable: true })
  followUpSuggestionsInstructions!: string | null

  @Column({ type: "integer", name: "follow_up_suggestions_max", default: 2, nullable: false })
  followUpSuggestionsMax!: number
}
