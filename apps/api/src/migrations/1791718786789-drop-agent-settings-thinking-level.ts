import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The thinking level now lives in the model options (`provider_options`), filled from the
 * temperature by SetAgentSettingsProviderOptionsFromTemperature1791703856140: the column is no
 * longer read. `down()` restores it on its default, the previous values are not kept.
 */
export class DropAgentSettingsThinkingLevel1791718786789 implements MigrationInterface {
  name = "DropAgentSettingsThinkingLevel1791718786789"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "thinking_level"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "thinking_level" character varying NOT NULL DEFAULT 'auto'`,
    )
  }
}
