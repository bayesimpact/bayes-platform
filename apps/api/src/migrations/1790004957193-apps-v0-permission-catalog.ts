import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Apps V0 catalog: document CRUD on project owner/admin, global `app.install`
 * for platform staff and superadmin, `backoffice.app.manage` for superadmin
 * only, and global `backoffice.project.read` for staff so the install picker
 * lists projects. No schema change — role_permission rows only.
 */
export class AppsV0PermissionCatalog1790004957193 implements MigrationInterface {
  name = "AppsV0PermissionCatalog1790004957193"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('app.install'),
          ('backoffice.project.read')
      ) AS permission(key)
      WHERE role.key = 'platform_staff'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('app.install'),
          ('backoffice.app.manage')
      ) AS permission(key)
      WHERE role.key = 'platform_superadmin'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('document.read'),
          ('document.create'),
          ('document.update'),
          ('document.delete')
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
        AND role.key = 'platform_staff'
        AND role_permission.permission_key IN ('app.install', 'backoffice.project.read')
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_superadmin'
        AND role_permission.permission_key IN ('app.install', 'backoffice.app.manage')
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN (
          'document.read',
          'document.create',
          'document.update',
          'document.delete'
        )
    `)
  }
}
