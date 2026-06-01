import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsToAgentMessage1782631888737 implements MigrationInterface {
  name = "AddAgentSettingsToAgentMessage1782631888737"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_message" ADD "agent_settings_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "agent_message" ADD CONSTRAINT "FK_635efa927238cfb23fade77dcdd" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    //fixme DOO set values
    await queryRunner.query(`
      UPDATE "agent_message" AS "am"
      SET "agent_settings_id" = "as"."id"
      FROM (
             SELECT
               "am"."id" AS "message_id",
               COALESCE("cas"."agent_id", "eas"."agent_id", "fas"."agent_id") AS "agent_id"
             FROM "agent_message" AS "am"
                    LEFT JOIN "conversation_agent_session" "cas" ON "cas"."id" = "am"."session_id"
                    LEFT JOIN "extraction_agent_session" "eas" ON "eas"."id" = "am"."session_id"
                    LEFT JOIN "form_agent_session" "fas" ON "fas"."id" = "am"."session_id"
           ) AS "agent_session"
             JOIN "agent_settings" AS "as"
                  ON "as".agent_id = "agent_session"."agent_id" AND "as"."revision" = 1
      WHERE "am"."id" = "agent_session"."message_id";`)

    await queryRunner.query(
      `ALTER TABLE "agent_message" ALTER COLUMN "agent_settings_id" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_message" DROP CONSTRAINT "FK_635efa927238cfb23fade77dcdd"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_message" DROP COLUMN "agent_settings_id"`)
  }
}
