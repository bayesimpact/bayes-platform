import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * LLM token metering (ADR 0033): the durable ledger `llm_usage` (one row per LLM
 * call), the live pricing table `llm_model_price` (one current price per model
 * and token kind), and the read-only `analytics.llm_usage` view, which joins the
 * ledger to the current prices to compute the cost at read time (so changing a
 * price re-prices the history). The ledger has a retention of its own,
 * independent of the conversation; the API never reads it back.
 *
 * The view drops the row id and `agent_message_id` (a view never exposes an id
 * or a message id) and joins the organization and project names, like the other
 * analytics views.
 */
export class LlmUsageMetering1793810000000 implements MigrationInterface {
  name = "LlmUsageMetering1793810000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "llm_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "agent_message_id" uuid,
        "model" character varying NOT NULL,
        "provider" character varying NOT NULL,
        "call_kind" character varying NOT NULL,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "cache_read_tokens" integer NOT NULL DEFAULT 0,
        "cache_write_tokens" integer NOT NULL DEFAULT 0,
        "reasoning_tokens" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_llm_usage" PRIMARY KEY ("id")
      )`,
    )
    await queryRunner.query(
      `CREATE INDEX "ix_llm_usage_agent_message" ON "llm_usage" ("agent_message_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "ix_llm_usage_project_created" ON "llm_usage" ("project_id", "created_at")`,
    )
    await queryRunner.query(
      `CREATE INDEX "ix_llm_usage_org_created" ON "llm_usage" ("organization_id", "created_at")`,
    )
    await queryRunner.query(
      `CREATE TABLE "llm_model_price" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "model" character varying NOT NULL,
        "token_kind" character varying NOT NULL,
        "price_per_million" numeric(12,6) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'USD',
        CONSTRAINT "uq_llm_model_price_model_kind" UNIQUE ("model", "token_kind"),
        CONSTRAINT "PK_llm_model_price" PRIMARY KEY ("id")
      )`,
    )
    await queryRunner.query(`CREATE VIEW "analytics"."llm_usage" AS
    SELECT u.organization_id,
           u.project_id,
           u.agent_id,
           p.name AS project_name,
           o.name AS organization_name,
           u.model,
           u.provider,
           u.call_kind,
           u.input_tokens,
           u.output_tokens,
           u.cache_read_tokens,
           u.cache_write_tokens,
           u.reasoning_tokens,
           u.created_at,
           (
             (COALESCE(p_in.price_per_million, 0) * u.input_tokens)
             + (COALESCE(p_out.price_per_million, 0) * u.output_tokens)
             + (COALESCE(p_cr.price_per_million, 0) * u.cache_read_tokens)
             + (COALESCE(p_cw.price_per_million, 0) * u.cache_write_tokens)
             + (COALESCE(p_r.price_per_million, 0) * u.reasoning_tokens)
           ) / 1000000 AS cost
    FROM llm_usage u
    LEFT JOIN project p ON p.id = u.project_id AND p.deleted_at IS NULL
    LEFT JOIN organization o ON o.id = u.organization_id
    LEFT JOIN llm_model_price p_in ON p_in.model = u.model AND p_in.token_kind = 'input' AND p_in.deleted_at IS NULL
    LEFT JOIN llm_model_price p_out ON p_out.model = u.model AND p_out.token_kind = 'output' AND p_out.deleted_at IS NULL
    LEFT JOIN llm_model_price p_cr ON p_cr.model = u.model AND p_cr.token_kind = 'cache_read' AND p_cr.deleted_at IS NULL
    LEFT JOIN llm_model_price p_cw ON p_cw.model = u.model AND p_cw.token_kind = 'cache_write' AND p_cw.deleted_at IS NULL
    LEFT JOIN llm_model_price p_r ON p_r.model = u.model AND p_r.token_kind = 'reasoning' AND p_r.deleted_at IS NULL
    WHERE u.deleted_at IS NULL
  `)
    // The role was created by the analytics-schema migration; grant it the new
    // view (default privileges apply to tables, not views, so it is explicit).
    await queryRunner.query(`GRANT SELECT ON "analytics"."llm_usage" TO analytics_reader`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT ON "analytics"."llm_usage" FROM analytics_reader`)
    await queryRunner.query(`DROP VIEW "analytics"."llm_usage"`)
    await queryRunner.query(`DROP TABLE "llm_model_price"`)
    await queryRunner.query(`DROP TABLE "llm_usage"`)
  }
}
