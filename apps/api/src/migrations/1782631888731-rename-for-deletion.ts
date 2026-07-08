import type { MigrationInterface, QueryRunner } from "typeorm"

export class RenameForDeletion1782631888731 implements MigrationInterface {
  name = "RenameForDeletion1782631888731"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "default_prompt" TO "_deleted_default_prompt"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" RENAME COLUMN "model" TO "_deleted_model"`)
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "temperature" TO "_deleted_temperature"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" RENAME COLUMN "locale" TO "_deleted_locale"`)
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "documents_rag_mode" TO "_deleted_documents_rag_mode"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "instruction_prompt" TO "_deleted_instruction_prompt"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "greeting_message" TO "_deleted_greeting_message"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "output_json_schema" TO "_deleted_output_json_schema"`,
    )

    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" RENAME COLUMN "schema_snapshot" TO "_deleted_schema_snapshot"`,
    )

    await queryRunner.query(
      `ALTER TABLE "agent" ALTER COLUMN "_deleted_default_prompt" DROP NOT NULL`,
    )
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_model" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_temperature" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_locale" DROP NOT NULL`)
    await queryRunner.query(
      `ALTER TABLE "agent" ALTER COLUMN "_deleted_documents_rag_mode" DROP NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent" ALTER COLUMN "_deleted_documents_rag_mode" SET NOT NULL`,
    )
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_locale" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_temperature" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "agent" ALTER COLUMN "_deleted_model" SET NOT NULL`)
    await queryRunner.query(
      `ALTER TABLE "agent" ALTER COLUMN "_deleted_default_prompt" SET NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_default_prompt" TO "default_prompt"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" RENAME COLUMN "_deleted_model" TO "model"`)
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_temperature" TO "temperature"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" RENAME COLUMN "_deleted_locale" TO "locale"`)
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_documents_rag_mode" TO "documents_rag_mode"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_instruction_prompt" TO "instruction_prompt"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_greeting_message" TO "greeting_message"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" RENAME COLUMN "_deleted_output_json_schema" TO "output_json_schema"`,
    )

    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" RENAME COLUMN "_deleted_schema_snapshot" TO "schema_snapshot"`,
    )
  }
}
