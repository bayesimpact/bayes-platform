import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToEvaluationReport1782631888734 implements MigrationInterface {
  name = "AddAgentSettingsToEvaluationReport1782631888734"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "evaluation_report" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" ADD CONSTRAINT "FK_d4abacf0b1ad5be81ebac4d140a" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "evaluation_report" AS "er" SET "agent_settings_id" = "as"."id" FROM "agent_settings" AS "as" WHERE "as"."agent_id" = "er"."agent_id" AND "as"."revision" = 1
    `)

    await queryRunner.query(
      `ALTER TABLE "evaluation_report" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_report" DROP CONSTRAINT "FK_d4abacf0b1ad5be81ebac4d140a"`,
    )
    await queryRunner.query(`ALTER TABLE "evaluation_report" DROP COLUMN "agent_settings_id"`)
  }
}
