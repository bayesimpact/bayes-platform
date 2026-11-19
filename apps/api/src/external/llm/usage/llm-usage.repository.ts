import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { LlmUsageCallKind } from "./llm-usage.entity"

/** The token numbers of one metered LLM call. */
export type LlmUsageRecord = {
  organizationId: string
  projectId: string
  agentId: string
  /** The assistant message the call belongs to, or null when there is none. */
  agentMessageId?: string | null
  model: string
  provider: string
  callKind: LlmUsageCallKind
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}

/**
 * Writes the token ledger rows (ADR 0033). The ledger is write-only for the API
 * — it is read back through the `analytics.llm_usage` view, never through this
 * repository. A row is one per LLM call; the insert is a plain SQL statement on
 * the ambient (or default) manager, so a metering write auto-commits on its own
 * and never needs a surrounding transaction.
 */
@Injectable()
export class LlmUsageRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Inserts one ledger row. The caller (the meter) is responsible for keeping a
   * failure from breaking the LLM call; this method may reject on a database
   * error and the meter logs it.
   */
  async insert(record: LlmUsageRecord): Promise<void> {
    await this.transactionService.getManager().query(
      `INSERT INTO llm_usage
          (organization_id, project_id, agent_id, agent_message_id,
           model, provider, call_kind,
           input_tokens, output_tokens, cache_read_tokens,
           cache_write_tokens, reasoning_tokens)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        record.organizationId,
        record.projectId,
        record.agentId,
        record.agentMessageId ?? null,
        record.model,
        record.provider,
        record.callKind,
        record.inputTokens,
        record.outputTokens,
        record.cacheReadTokens,
        record.cacheWriteTokens,
        record.reasoningTokens,
      ],
    )
  }
}
