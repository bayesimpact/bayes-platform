import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * A CSV extraction run is now reached by its creator only. `csv_extraction_run.others.manage`
 * lets project owners and admins keep reaching every run of the project. No schema change,
 * role_permission rows only.
 */
export class CsvExtractionRunOthersManagePermission1791212036705 implements MigrationInterface {
  name = "CsvExtractionRunOthersManagePermission1791212036705"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'csv_extraction_run.others.manage'
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
        AND role_permission.permission_key = 'csv_extraction_run.others.manage'
    `)
  }
}
