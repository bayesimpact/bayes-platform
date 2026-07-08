import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToEvaluationExtractionRun1782631888733 implements MigrationInterface {
  name = "AddAgentSettingsToEvaluationExtractionRun1782631888733"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "evaluation_extraction_run" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_run" ADD CONSTRAINT "FK_90d58a0b5e81fea5deea29d0faf" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "evaluation_extraction_run" AS "eer" SET "agent_settings_id" = "as"."id" FROM "agent_settings" AS "as" WHERE "as"."agent_id" = "eer"."agent_id" AND "as"."revision" = 1
    `)

    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_run" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_run" DROP CONSTRAINT "FK_90d58a0b5e81fea5deea29d0faf"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_run" DROP COLUMN "agent_settings_id"`,
    )
  }
}
