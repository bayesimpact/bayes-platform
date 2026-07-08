import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToExtractionAgentSession1782631888736 implements MigrationInterface {
  name = "AddAgentSettingsToExtractionAgentSession1782631888736"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "extraction_agent_session" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" ADD CONSTRAINT "FK_c5aee4307955e99edb706255600" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "extraction_agent_session" AS "eas" SET "agent_settings_id" = "as"."id" FROM "agent_settings" AS "as" WHERE "as"."agent_id" = "eas"."agent_id" AND "as"."revision" = 1
    `)

    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" DROP CONSTRAINT "FK_c5aee4307955e99edb706255600"`,
    )
    await queryRunner.query(
      `ALTER TABLE "extraction_agent_session" DROP COLUMN "agent_settings_id"`,
    )
  }
}
