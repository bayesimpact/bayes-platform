import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsColumnsForPublish1785130819345 implements MigrationInterface {
  name = "AddAgentSettingsColumnsForPublish1785130819345"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "revision_name" text`)
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "revision_desc" text`)
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "is_draft" boolean NOT NULL DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "is_draft"`)
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "revision_desc"`)
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "revision_name"`)
  }
}
