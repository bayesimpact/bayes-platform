import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * One permission per user interface of a project: `desk.ui.read` on project
 * owner/admin/member, `studio.ui.read` and `evaluation.ui.read` on project owner/admin.
 * `evaluation.ui.read` replaces `evaluation.access`. No schema change,
 * role_permission rows only.
 */
export class UiReadPermissions1790930792020 implements MigrationInterface {
  name = "UiReadPermissions1790930792020"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, grant_row.permission_key
      FROM "role" AS role
      JOIN (
        VALUES
          ('project_owner', 'desk.ui.read'),
          ('project_admin', 'desk.ui.read'),
          ('project_member', 'desk.ui.read'),
          ('project_owner', 'studio.ui.read'),
          ('project_admin', 'studio.ui.read'),
          ('project_owner', 'evaluation.ui.read'),
          ('project_admin', 'evaluation.ui.read')
      ) AS grant_row (role_key, permission_key) ON grant_row.role_key = role.key
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      DELETE FROM "role_permission"
      WHERE permission_key = 'evaluation.access'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'evaluation.access'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin', 'project_member')
        AND role_permission.permission_key IN ('desk.ui.read', 'studio.ui.read', 'evaluation.ui.read')
    `)
  }
}
