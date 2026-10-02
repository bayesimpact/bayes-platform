import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * CSV extraction runs move to RBAC, with the same people the legacy run policy let in:
 * `csv_extraction_run.read`, `.create`, `.update` and `.delete` on every project role, and
 * `csv_extraction_run.playground` on project owner/admin only. No schema change, role_permission
 * rows only.
 */
export class CsvExtractionRunPermissions1790868961541 implements MigrationInterface {
  name = "CsvExtractionRunPermissions1790868961541"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('csv_extraction_run.read'),
          ('csv_extraction_run.create'),
          ('csv_extraction_run.update'),
          ('csv_extraction_run.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin', 'project_member')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'csv_extraction_run.playground'
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
        AND role.key IN ('project_owner', 'project_admin', 'project_member')
        AND role_permission.permission_key IN (
          'csv_extraction_run.read',
          'csv_extraction_run.create',
          'csv_extraction_run.update',
          'csv_extraction_run.delete',
          'csv_extraction_run.playground'
        )
    `)
  }
}
