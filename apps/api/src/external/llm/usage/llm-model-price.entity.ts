import { Column, Entity, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

/** The token kinds a price applies to. One row per (model, kind). */
export type LlmModelPriceTokenKind = "input" | "output" | "cache_read" | "cache_write" | "reasoning"

/**
 * The live reference of the prices (ADR 0033): one current price per model and
 * token kind. It is the only thing maintained to keep the cost current. The
 * metering point does not read it — only the `analytics.llm_usage` view does,
 * joining each call to the price of its model and token kind. Maintained by a
 * backoffice permission or a maintenance script, not the API.
 */
@Entity("llm_model_price")
@Unique("uq_llm_model_price_model_kind", ["model", "tokenKind"])
export class LlmModelPrice extends Base4AllEntity {
  @Column({ type: "varchar", name: "model" })
  model!: string

  @Column({ type: "varchar", name: "token_kind" })
  tokenKind!: LlmModelPriceTokenKind

  /** The price in {@link currency} per one million tokens of {@link tokenKind}. */
  @Column({ type: "numeric", precision: 12, scale: 6, name: "price_per_million" })
  pricePerMillion!: string

  @Column({ type: "varchar", name: "currency", default: "USD" })
  currency!: string
}
