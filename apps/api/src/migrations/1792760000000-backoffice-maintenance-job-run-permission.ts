import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Grants `backoffice.maintenance_job.run` to `platform_superadmin`: seeing and running the
 * one-off maintenance jobs of the backoffice.
 */
export class BackofficeMaintenanceJobRunPermission1792760000000 implements MigrationInterface {
  name = "BackofficeMaintenanceJobRunPermission1792760000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.maintenance_job.run'
      FROM "role" AS role
      WHERE role.key = 'platform_superadmin'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_superadmin'
        AND role_permission.permission_key = 'backoffice.maintenance_job.run'
    `)
  }
}
