import { Injectable, Logger } from "@nestjs/common"
import { metrics } from "@opentelemetry/api"
import type { LanguageModelUsage } from "ai"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import type { LlmUsageCallKind } from "./llm-usage.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type LlmUsageRecord, LlmUsageRepository } from "./llm-usage.repository"

/** The token kinds a call is metered in, one counter increment each. */
type TokenKind = "input" | "output" | "cache_read" | "cache_write" | "reasoning"

/**
 * The single metering point for LLM token consumption (ADR 0033). One call is
 * metered once, wherever it comes from, at the LLM call boundary (the provider
 * base). It writes the usage in two forms, from the same numbers, so they always
 * agree: a live metric (the burn) and a durable ledger row (the history). The
 * cost is not written — it is computed from the ledger and the current prices
 * when the `analytics.llm_usage` view is read.
 *
 * Metering is best-effort: a failure here must never break the LLM call. The
 * metric is emitted synchronously; the ledger row is written fire-and-forget,
 * and both are wrapped so an error is only logged.
 */
@Injectable()
export class LlmUsageMeter {
  private readonly logger = new Logger(LlmUsageMeter.name)
  private readonly meter = metrics.getMeter("llm-usage")
  private readonly tokensCounter = this.meter.createCounter("llm.tokens", {
    description: "LLM tokens consumed per call, by organization, project, agent and model",
  })

  constructor(private readonly llmUsageRepository: LlmUsageRepository) {}

  /**
   * Records the usage of one LLM call: the metric now, the ledger row
   * fire-and-forget. Never throws.
   */
  recordUsage(args: {
    callContext: LLMCallContext
    model: string
    provider: string
    callKind: LlmUsageCallKind
    usage: LanguageModelUsage
  }): void {
    const record = this.toRecord(args)
    try {
      this.recordMetric(record)
    } catch (error) {
      this.logger.warn("Failed to record the LLM token metric", error)
    }
    void this.llmUsageRepository.insert(record).catch((error: unknown) => {
      this.logger.warn("Failed to write an LLM usage ledger row", error)
    })
  }

  private toRecord(args: {
    callContext: LLMCallContext
    model: string
    provider: string
    callKind: LlmUsageCallKind
    usage: LanguageModelUsage
  }): LlmUsageRecord {
    const { usage } = args
    return {
      organizationId: args.callContext.organizationId,
      projectId: args.callContext.projectId,
      agentId: args.callContext.agentId,
      agentMessageId: args.callContext.agentMessageId ?? null,
      model: args.model,
      provider: args.provider,
      callKind: args.callKind,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
    }
  }

  private recordMetric(record: LlmUsageRecord): void {
    const base = {
      organization_id: record.organizationId,
      project_id: record.projectId,
      agent_id: record.agentId,
      model: record.model,
      provider: record.provider,
    }
    const kinds: Record<TokenKind, number> = {
      input: record.inputTokens,
      output: record.outputTokens,
      cache_read: record.cacheReadTokens,
      cache_write: record.cacheWriteTokens,
      reasoning: record.reasoningTokens,
    }
    for (const [tokenKind, tokens] of Object.entries(kinds)) {
      if (tokens > 0) this.tokensCounter.add(tokens, { ...base, token_kind: tokenKind })
    }
  }
}
