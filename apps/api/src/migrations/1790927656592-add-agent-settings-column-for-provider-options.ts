import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsColumnForProviderOptions1790927656592 implements MigrationInterface {
  name = "AddAgentSettingsColumnForProviderOptions1790927656592"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "provider_options" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "provider_options"`)
  }
}
