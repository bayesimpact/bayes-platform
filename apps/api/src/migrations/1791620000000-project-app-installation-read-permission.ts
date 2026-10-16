import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Project owners and admins can list the apps installed on their project from the studio:
 * `project.app_installation.read` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectAppInstallationReadPermission1791620000000 implements MigrationInterface {
  name = "ProjectAppInstallationReadPermission1791620000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.app_installation.read'
      FROM "role" AS role
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
        AND role_permission.permission_key = 'project.app_installation.read'
    `)
  }
}
