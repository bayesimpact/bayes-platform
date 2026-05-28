import type { MigrationInterface, QueryRunner } from "typeorm"

export class RenameFeatureFlagKeys1779954765300 implements MigrationInterface {
  name = "RenameFeatureFlagKeys1779954765300"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE feature_flag
      SET feature_flag_key = 'sources-tool'
      WHERE feature_flag_key = 'sources_tool'
    `)
    await queryRunner.query(`
      UPDATE feature_flag
      SET feature_flag_key = 'web-sources'
      WHERE feature_flag_key = 'web_sources'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE feature_flag
      SET feature_flag_key = 'sources_tool'
      WHERE feature_flag_key = 'sources-tool'
    `)
    await queryRunner.query(`
      UPDATE feature_flag
      SET feature_flag_key = 'web_sources'
      WHERE feature_flag_key = 'web-sources'
    `)
  }
}
