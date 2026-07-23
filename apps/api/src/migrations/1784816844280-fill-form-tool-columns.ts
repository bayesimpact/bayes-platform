import type { MigrationInterface, QueryRunner } from "typeorm"

export class FillFormToolColumns1784816844280 implements MigrationInterface {
  name = "FillFormToolColumns1784816844280"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "result" jsonb`)
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "fill_form_enabled" boolean NOT NULL DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "fill_form_enabled"`)
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" DROP COLUMN "result"`)
  }
}
