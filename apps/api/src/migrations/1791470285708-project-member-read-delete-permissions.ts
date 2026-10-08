import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Project memberships move to RBAC, with the same people the legacy policy let in:
 * `project.member.read` and `project.member.delete` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectMemberReadDeletePermissions1791470285708 implements MigrationInterface {
  name = "ProjectMemberReadDeletePermissions1791470285708"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('project.member.read'),
          ('project.member.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN ('project.member.read', 'project.member.delete')
    `)
  }
}
