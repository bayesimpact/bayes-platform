import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * `evaluation.access` opens a project's evaluation app. Granted on project owner/admin,
 * the roles that already hold the evaluation dataset permissions. No schema change,
 * role_permission rows only.
 */
export class EvaluationAccessPermission1790698550298 implements MigrationInterface {
  name = "EvaluationAccessPermission1790698550298"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'evaluation.access'
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
        AND role_permission.permission_key = 'evaluation.access'
    `)
  }
}
