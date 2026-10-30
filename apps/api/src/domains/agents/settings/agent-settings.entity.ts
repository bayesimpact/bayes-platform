import {
  type AgentMemoryMode,
  type AgentModel,
  DEFAULT_EMBEDDING_MODEL,
  type DocumentsRagMode,
  type EmbeddingModel,
} from "@caseai-connect/api-contracts"
import { Column, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"

@ConnectEntityWithUniqueIndex("agent_settings", "agentId", "revision")
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
   * The model the knowledge base lookup embeds the query with. Always a real name, never "the
   * default": changing the platform default must not move existing agents to vectors their
   * project may not have.
   */
  @Column({
    type: "varchar",
    name: "embedding_model",
    nullable: false,
    default: DEFAULT_EMBEDDING_MODEL,
  })
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
}
