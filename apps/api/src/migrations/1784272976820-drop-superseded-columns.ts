import type { MigrationInterface, QueryRunner } from "typeorm"

export class DropSupersededColumns1784272976820 implements MigrationInterface {
  name = "DropSupersededColumns1784272976820"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e"`,
    )
    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" DROP COLUMN "_deleted_schema_snapshot"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_temperature"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_output_json_schema"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_default_prompt"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_model"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_locale"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_instruction_prompt"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_documents_rag_mode"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "_deleted_greeting_message"`)
    await queryRunner.query(`ALTER TABLE "agent_csv_extraction_run" DROP COLUMN "agent_id"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_csv_extraction_run" ADD "agent_id" uuid NOT NULL`)
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_greeting_message" text`)
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "_deleted_documents_rag_mode" character varying DEFAULT 'all'`,
    )
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_instruction_prompt" text`)
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_locale" character varying`)
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_model" character varying`)
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_default_prompt" text`)
    await queryRunner.query(`ALTER TABLE "agent" ADD "_deleted_output_json_schema" jsonb`)
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "_deleted_temperature" numeric(3,2) DEFAULT '0'`,
    )
    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" ADD "_deleted_schema_snapshot" jsonb NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }
}
