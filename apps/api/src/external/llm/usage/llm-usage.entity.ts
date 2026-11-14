import { Column, Entity, Index } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

/**
 * What a metered call is: the answer of a turn, an internal call, an extraction
 * run, or an embedding. In this version the provider base meters `answer` (the
 * streamed turn) and `internal` (the non-streamed generations); `extraction`
 * and `embedding` are reserved values for wiring that routes through another
 * metering point (extraction runs today go through `generateStructuredOutput`,
 * embeddings bypass the LLM provider entirely).
 */
export type LlmUsageCallKind = "answer" | "internal" | "extraction" | "embedding"

/**
 * The durable token ledger: one row per LLM call (ADR 0033). It has a retention
 * of its own, independent of the conversation — purging a conversation does not
 * touch it. Written through {@link LlmUsageRepository}; the API never reads it
 * back. The cost is not stored: it is computed by the `analytics.llm_usage` view
 * from the current prices, at read time.
 */
@Entity("llm_usage")
@Index("ix_llm_usage_agent_message", ["agentMessageId"])
@Index("ix_llm_usage_project_created", ["projectId", "createdAt"])
@Index("ix_llm_usage_org_created", ["organizationId", "createdAt"])
export class LlmUsage extends Base4AllEntity {
  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  /**
   * The assistant message the call belongs to, when there is one: the answer of
   * a turn or a sub-agent's message. Null for a standalone extraction run or an
   * embedding.
   */
  @Column({ type: "uuid", name: "agent_message_id", nullable: true })
  agentMessageId!: string | null

  @Column({ type: "varchar", name: "model" })
  model!: string

  @Column({ type: "varchar", name: "provider" })
  provider!: string

  @Column({ type: "varchar", name: "call_kind" })
  callKind!: LlmUsageCallKind

  @Column({ type: "integer", name: "input_tokens", default: 0 })
  inputTokens!: number

  @Column({ type: "integer", name: "output_tokens", default: 0 })
  outputTokens!: number

  @Column({ type: "integer", name: "cache_read_tokens", default: 0 })
  cacheReadTokens!: number

  @Column({ type: "integer", name: "cache_write_tokens", default: 0 })
  cacheWriteTokens!: number

  @Column({ type: "integer", name: "reasoning_tokens", default: 0 })
  reasoningTokens!: number
}
