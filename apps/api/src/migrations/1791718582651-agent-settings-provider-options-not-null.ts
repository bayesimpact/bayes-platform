import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Every agent settings revision carries its model options: the column is filled by
 * SetAgentSettingsProviderOptionsFromTemperature1791703856140, which runs before.
 */
export class AgentSettingsProviderOptionsNotNull1791718582651 implements MigrationInterface {
  name = "AgentSettingsProviderOptionsNotNull1791718582651"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ALTER COLUMN "provider_options" SET NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ALTER COLUMN "provider_options" DROP NOT NULL`,
    )
  }
}
