import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Resource libraries move to RBAC: `resource_library.read`, `resource_library.create`,
 * `resource_library.update` and `resource_library.delete` on project owner/admin, the
 * same people the legacy resource library policy let in. No schema change,
 * role_permission rows only.
 */
export class ResourceLibraryPermissions1790864171504 implements MigrationInterface {
  name = "ResourceLibraryPermissions1790864171504"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('resource_library.read'),
          ('resource_library.create'),
          ('resource_library.update'),
          ('resource_library.delete')
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
        AND role_permission.permission_key IN (
          'resource_library.read',
          'resource_library.create',
          'resource_library.update',
          'resource_library.delete'
        )
    `)
  }
}
