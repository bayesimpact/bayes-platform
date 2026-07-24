import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Drops the form_agent_session table: all of its rows were copied into
 * conversation_agent_session by MigrateFormAgentsToConversation1784816949038
 * (issue #558 — the form agent type is replaced by the fillForm tool).
 *
 * Hand-written because TypeORM's migration:generate never emits DROP TABLE for
 * a removed entity. down() recreates the table exactly as it existed (schema
 * only); reverting this migration and then the data migration restores the
 * rows.
 */
export class DropFormAgentSession1784817809114 implements MigrationInterface {
  name = "DropFormAgentSession1784817809114"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "form_agent_session"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "form_agent_session" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "trace_id" uuid,
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "result" jsonb,
        "campaign_id" uuid,
        "parent_session_id" uuid,
        CONSTRAINT "PK_61dc34e2df3b71ee97bb2e4544c" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_ca972359d54a9e7cfe6d71c58d" ON "form_agent_session" ("organization_id", "project_id", "agent_id", "type")`,
    )
    await queryRunner.query(
      `ALTER TABLE "form_agent_session" ADD CONSTRAINT "FK_77aa08e22f91f71444a09cf039d" FOREIGN KEY ("campaign_id") REFERENCES "review_campaign"("id")`,
    )
  }
}
