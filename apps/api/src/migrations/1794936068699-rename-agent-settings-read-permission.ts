import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * `agent.settings.draft.read` becomes `agent.settings.read`: the key opens every revision of an
 * agent's settings, not only its draft. The same roles keep it. No schema change:
 * role_permission rows only.
 */
export class RenameAgentSettingsReadPermission1794936068699 implements MigrationInterface {
  name = "RenameAgentSettingsReadPermission1794936068699"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "role_permission"
      SET "permission_key" = 'agent.settings.read'
      WHERE "permission_key" = 'agent.settings.draft.read'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "role_permission"
      SET "permission_key" = 'agent.settings.draft.read'
      WHERE "permission_key" = 'agent.settings.read'
    `)
  }
}
