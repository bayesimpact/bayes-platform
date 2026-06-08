import type { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAgentCsvExtractionRun1780655802131 implements MigrationInterface {
  name = "CreateAgentCsvExtractionRun1780655802131"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_csv_extraction_run_record" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "agent_csv_extraction_run_id" uuid NOT NULL, "row_index" integer NOT NULL, "input_data" jsonb, "agent_raw_output" jsonb, "status" character varying NOT NULL DEFAULT 'running', "error_details" text, "trace_id" character varying, CONSTRAINT "PK_f25a9085cbb041bf7b1be9891e9" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ccd6cc198397a59f65f2d570d6" ON "agent_csv_extraction_run_record" ("organization_id", "project_id", "agent_csv_extraction_run_id", "status") `,
    )
    await queryRunner.query(
      `CREATE TABLE "agent_csv_extraction_run" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "csv_document_id" uuid NOT NULL, "column_schema" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "summary" jsonb, "csv_export_document_id" uuid, CONSTRAINT "PK_3a5953723f3ac0b62bba5b6b450" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_bbf0248990408548c3685af9f4" ON "agent_csv_extraction_run" ("organization_id", "project_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run_record" ADD CONSTRAINT "FK_535cbfc627deca97a9718b5fb04" FOREIGN KEY ("agent_csv_extraction_run_id") REFERENCES "agent_csv_extraction_run"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_471203f05af1938b9cd132cd895" FOREIGN KEY ("csv_document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_9f2c093a68f132c9efd92e6d84b" FOREIGN KEY ("csv_export_document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_9f2c093a68f132c9efd92e6d84b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_471203f05af1938b9cd132cd895"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run_record" DROP CONSTRAINT "FK_535cbfc627deca97a9718b5fb04"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_bbf0248990408548c3685af9f4"`)
    await queryRunner.query(`DROP TABLE "agent_csv_extraction_run"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ccd6cc198397a59f65f2d570d6"`)
    await queryRunner.query(`DROP TABLE "agent_csv_extraction_run_record"`)
  }
}
