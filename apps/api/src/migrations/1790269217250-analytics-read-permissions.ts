import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Analytics move to RBAC: `project.analytics.read` on project owner/admin and
 * `agent.analytics.read` on agent owner/admin, the same people the legacy
 * analytics policies let in. No schema change — role_permission rows only.
 */
export class AnalyticsReadPermissions1790269217250 implements MigrationInterface {
  name = "AnalyticsReadPermissions1790269217250"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.analytics.read'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.analytics.read'
      FROM "role" AS role
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
        AND role_permission.permission_key = 'project.analytics.read'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('agent_owner', 'agent_admin')
        AND role_permission.permission_key = 'agent.analytics.read'
    `)
  }
}
