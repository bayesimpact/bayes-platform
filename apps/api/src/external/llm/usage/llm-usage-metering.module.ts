import { Module } from "@nestjs/common"
import { LlmUsageRepository } from "./llm-usage.repository"
import { LlmUsageMeter } from "./llm-usage-meter"

/**
 * Provides the LLM usage metering (ADR 0033): the repository that writes the
 * token ledger rows, and the meter that emits the live metric and triggers the
 * ledger write at the LLM call boundary. Imported by {@link LlmModule} so the
 * provider base can inject the meter; the meter is optional at injection time,
 * so a provider that is built without it (the test providers) simply does not
 * meter.
 */
@Module({
  providers: [LlmUsageRepository, LlmUsageMeter],
  exports: [LlmUsageMeter],
})
export class LlmUsageMeteringModule {}
