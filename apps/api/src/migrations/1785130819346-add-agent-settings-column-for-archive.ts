import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsColumnForArchive1785130819346 implements MigrationInterface {
  name = "AddAgentSettingsColumnForArchive1785130819346"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "is_archived" boolean NOT NULL DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "is_archived"`)
  }
}
