import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Agent settings move to RBAC: `agent.settings.draft.read` on project owner/admin, and
 * `agent.settings.draft.update` / `agent.settings.draft.publish` / `agent.settings.restore`
 * / `agent.settings.archive` on agent owner/admin, the same people the legacy agent policy
 * let in. No schema change — role_permission rows only.
 */
export class AgentSettingsPermissions1791364241729 implements MigrationInterface {
  name = "AgentSettingsPermissions1791364241729"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.settings.draft.read'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.settings.draft.update'),
          ('agent.settings.draft.publish'),
          ('agent.settings.restore'),
          ('agent.settings.archive')
      ) AS permission(key)
      WHERE role.key IN ('agent_owner', 'agent_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key = 'agent.settings.draft.read'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('agent_owner', 'agent_admin')
        AND role_permission.permission_key IN (
          'agent.settings.draft.update',
          'agent.settings.draft.publish',
          'agent.settings.restore',
          'agent.settings.archive'
        )
    `)
  }
}
