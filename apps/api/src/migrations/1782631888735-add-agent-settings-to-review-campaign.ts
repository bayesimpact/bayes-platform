import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToReviewCampaign1782631888735 implements MigrationInterface {
  name = "AddAgentSettingsToReviewCampaign1782631888735"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "review_campaign" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "review_campaign" ADD CONSTRAINT "FK_40631cb0186f2f5f539edaa1909" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "review_campaign" AS "rc" SET "agent_settings_id" = "as"."id" FROM "agent_settings" AS "as" WHERE "as"."agent_id" = "rc"."agent_id" AND "as"."revision" = 1
    `)

    await queryRunner.query(
      `ALTER TABLE "review_campaign" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "review_campaign" DROP CONSTRAINT "FK_40631cb0186f2f5f539edaa1909"`,
    )
    await queryRunner.query(`ALTER TABLE "review_campaign" DROP COLUMN "agent_settings_id"`)
  }
}
