import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Restores the pre-RBAC terms gate: only platform_superadmin may manage
 * terms documents. `PlatformRolesAndPermissions1785320282681` also granted
 * `backoffice.terms.update` to platform_staff (the former org-creator
 * domain). This migration revokes that extra grant on existing databases.
 */
export class RevokeTermsUpdateFromPlatformStaff1788271452103 implements MigrationInterface {
  name = "RevokeTermsUpdateFromPlatformStaff1788271452103"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_staff'
        AND role_permission.permission_key = 'backoffice.terms.update'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.terms.update'
      FROM "role" AS role
      WHERE role.key = 'platform_staff'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }
}
