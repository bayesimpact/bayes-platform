import { Column, Entity, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

/** The token kinds a price applies to. One row per (model, kind). */
export type LlmModelPriceTokenKind = "input" | "output" | "cache_read" | "cache_write" | "reasoning"

/**
 * The live reference of the prices (ADR 0033): one row per model, token kind
 * and price period, each period from `validFrom` (inclusive) to `validTo`
 * (exclusive). Exactly one row per model and token kind has `validTo` null:
 * the current price. It is the only thing maintained to keep the cost current;
 * a change closes the current row and opens a new one. The metering point does
 * not read it — only the `analytics.llm_usage` view does, joining each call to
 * the price in effect when the call was made. Maintained by a backoffice
 * permission or a maintenance script, not the API.
 */
@Entity("llm_model_price")
@Unique("uq_llm_model_price_model_kind_from", ["model", "tokenKind", "validFrom"])
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

  /** The first moment the price applies, inclusive. */
  @Column({ type: "timestamp", name: "valid_from" })
  validFrom!: Date

  /** The first moment the price stops applying, exclusive. Null on the current price. */
  @Column({ type: "timestamp", nullable: true, name: "valid_to" })
  validTo!: Date | null
}
