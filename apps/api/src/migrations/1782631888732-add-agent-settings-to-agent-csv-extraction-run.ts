import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToAgentCsvExtractionRun1782631888732 implements MigrationInterface {
  name = "AddAgentSettingsToAgentCsvExtractionRun1782631888732"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_471203f05af1938b9cd132cd895"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_csv_extraction_run" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_ed7c711b4c5ef3aba2c3b3f62c0" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_471203f05af1938b9cd132cd895" FOREIGN KEY ("csv_document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "agent_csv_extraction_run" AS "acer" SET "agent_settings_id" = "as"."id" FROM "agent_settings" AS "as" WHERE "as"."agent_id" = "acer"."agent_id" AND "as"."revision" = 1
    `)

    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_471203f05af1938b9cd132cd895"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_ed7c711b4c5ef3aba2c3b3f62c0"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" DROP COLUMN "agent_settings_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_878211fe5f64bb1ff2eae47c84e" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_csv_extraction_run" ADD CONSTRAINT "FK_471203f05af1938b9cd132cd895" FOREIGN KEY ("csv_document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }
}
