import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsColumnForThinking1790830873760 implements MigrationInterface {
  name = "AddAgentSettingsColumnForThinking1790830873760"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "thinking_level" character varying NOT NULL DEFAULT 'auto'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "thinking_level"`)
  }
}
