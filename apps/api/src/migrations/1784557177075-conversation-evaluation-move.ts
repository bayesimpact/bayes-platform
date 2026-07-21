import type { MigrationInterface, QueryRunner } from "typeorm"

export class ConversationEvaluationMove1784557177075 implements MigrationInterface {
  name = "ConversationEvaluationMove1784557177075"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "evaluation_conversation_dataset_record" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "evaluation_conversation_dataset_id" uuid NOT NULL, "input" text NOT NULL, "expected_output" text NOT NULL, CONSTRAINT "PK_0e292afb94a864e220899347c4e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_3f237f01230dd8153a6b052c43" ON "evaluation_conversation_dataset_record" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "evaluation_conversation_dataset" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_eae98c66d44ea806951ab5b54fb" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_bce57d26b83305214e7c8658a2" ON "evaluation_conversation_dataset" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "evaluation_conversation_run_record" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "evaluation_conversation_run_id" uuid NOT NULL, "evaluation_conversation_dataset_record_id" uuid, "status" character varying NOT NULL DEFAULT 'running', "input" text NOT NULL, "expected_output" text NOT NULL, "output" text, "score" integer, "error_details" text, "trace_id" character varying, CONSTRAINT "PK_02d404c2bdb630eee3c3c164d14" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_8c5d527881d9033e695a756537" ON "evaluation_conversation_run_record" ("organization_id", "project_id", "evaluation_conversation_run_id", "status") `,
    )
    await queryRunner.query(
      `CREATE TABLE "evaluation_conversation_run" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "evaluation_conversation_dataset_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "agent_settings_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "judge_model" character varying NOT NULL DEFAULT 'gemini-2.5-flash', "summary" jsonb, CONSTRAINT "PK_9c31de3e646edc0d255672e8c33" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_b97c4ba43d49c1c858c41d342b" ON "evaluation_conversation_run" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_dataset_record" ADD CONSTRAINT "FK_58798080de06e580192c7cc5169" FOREIGN KEY ("evaluation_conversation_dataset_id") REFERENCES "evaluation_conversation_dataset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" ADD CONSTRAINT "FK_7ff584bf90c0fbc24a9687546f9" FOREIGN KEY ("evaluation_conversation_run_id") REFERENCES "evaluation_conversation_run"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" ADD CONSTRAINT "FK_fe8aa4aee31f627c87439171a05" FOREIGN KEY ("evaluation_conversation_dataset_record_id") REFERENCES "evaluation_conversation_dataset_record"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" ADD CONSTRAINT "FK_1f12f830d5a0cfb7b0fc086eef8" FOREIGN KEY ("evaluation_conversation_dataset_id") REFERENCES "evaluation_conversation_dataset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" ADD CONSTRAINT "FK_8d217a118f789f2ec37745a1278" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" ADD CONSTRAINT "FK_39e182cae54a05aeb5ba843c5c7" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    // Move legacy Studio evaluations (input/expected_output pairs) into one
    // "Studio evaluations" conversation dataset per project, then drop the
    // legacy tables. Legacy evaluation ids are reused as record ids so the
    // move is reversible in down(). Soft-deleted evaluations are carried over
    // (deleted_at is copied) so no data is lost when the legacy table is
    // dropped. Legacy evaluation_report rows (one-shot scores) have no
    // equivalent in the run model and are not migrated.
    await queryRunner.query(`
      INSERT INTO "evaluation_conversation_dataset" ("organization_id", "project_id", "name")
      SELECT DISTINCT "organization_id", "project_id", 'Studio evaluations'
      FROM "evaluation"
    `)
    await queryRunner.query(`
      INSERT INTO "evaluation_conversation_dataset_record" ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id", "evaluation_conversation_dataset_id", "input", "expected_output")
      SELECT "legacy_evaluation"."id", "legacy_evaluation"."created_at", "legacy_evaluation"."updated_at", "legacy_evaluation"."deleted_at", "legacy_evaluation"."organization_id", "legacy_evaluation"."project_id", "dataset"."id", "legacy_evaluation"."input", "legacy_evaluation"."expected_output"
      FROM "evaluation" AS "legacy_evaluation"
      JOIN "evaluation_conversation_dataset" AS "dataset"
        ON "dataset"."project_id" = "legacy_evaluation"."project_id"
        AND "dataset"."organization_id" = "legacy_evaluation"."organization_id"
        AND "dataset"."name" = 'Studio evaluations'
    `)

    await queryRunner.query(
      `ALTER TABLE "evaluation" DROP CONSTRAINT "FK_255d175473dfeb23410514b7769"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" DROP CONSTRAINT "FK_d4abacf0b1ad5be81ebac4d140a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" DROP CONSTRAINT "FK_e86d3a2655af3d17b70e780e777"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" DROP CONSTRAINT "FK_08c8ea2cbde23fdea75d4d35154"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_76ed2aa183a791a671d32304d3"`)
    await queryRunner.query(`DROP TABLE "evaluation"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_393b0f28a1c9ee4d5cb24a0945"`)
    await queryRunner.query(`DROP TABLE "evaluation_report"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the legacy tables (schema as of migrations 1771858674952 +
    // 1782631888734) and copy the migrated records back. Legacy
    // evaluation_report rows cannot be restored.
    await queryRunner.query(
      `CREATE TABLE "evaluation_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "evaluation_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "agent_settings_id" uuid NOT NULL, "trace_id" uuid NOT NULL, "output" character varying NOT NULL, "score" character varying NOT NULL, CONSTRAINT "PK_0a99319233ecea545abcf2fe8b9" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_393b0f28a1c9ee4d5cb24a0945" ON "evaluation_report" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "evaluation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "input" character varying NOT NULL, "expected_output" character varying NOT NULL, CONSTRAINT "PK_b72edd439b9db736f55b584fa54" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_76ed2aa183a791a671d32304d3" ON "evaluation" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" ADD CONSTRAINT "FK_08c8ea2cbde23fdea75d4d35154" FOREIGN KEY ("evaluation_id") REFERENCES "evaluation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" ADD CONSTRAINT "FK_e86d3a2655af3d17b70e780e777" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" ADD CONSTRAINT "FK_d4abacf0b1ad5be81ebac4d140a" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation" ADD CONSTRAINT "FK_255d175473dfeb23410514b7769" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    // Restore ALL conversation dataset records (whatever dataset they belong to,
    // including renamed ones and soft-deleted records) since every conversation
    // table is dropped right after — anything not copied back would be lost.
    await queryRunner.query(`
      INSERT INTO "evaluation" ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id", "input", "expected_output")
      SELECT "record"."id", "record"."created_at", "record"."updated_at", "record"."deleted_at", "record"."organization_id", "record"."project_id", "record"."input", "record"."expected_output"
      FROM "evaluation_conversation_dataset_record" AS "record"
    `)

    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" DROP CONSTRAINT "FK_39e182cae54a05aeb5ba843c5c7"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" DROP CONSTRAINT "FK_8d217a118f789f2ec37745a1278"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" DROP CONSTRAINT "FK_1f12f830d5a0cfb7b0fc086eef8"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" DROP CONSTRAINT "FK_fe8aa4aee31f627c87439171a05"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" DROP CONSTRAINT "FK_7ff584bf90c0fbc24a9687546f9"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_dataset_record" DROP CONSTRAINT "FK_58798080de06e580192c7cc5169"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_b97c4ba43d49c1c858c41d342b"`)
    await queryRunner.query(`DROP TABLE "evaluation_conversation_run"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_8c5d527881d9033e695a756537"`)
    await queryRunner.query(`DROP TABLE "evaluation_conversation_run_record"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_bce57d26b83305214e7c8658a2"`)
    await queryRunner.query(`DROP TABLE "evaluation_conversation_dataset"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_3f237f01230dd8153a6b052c43"`)
    await queryRunner.query(`DROP TABLE "evaluation_conversation_dataset_record"`)
  }
}
