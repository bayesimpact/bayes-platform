import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Evaluation extraction runs move to RBAC: `evaluation.extraction.run.read`,
 * `evaluation.extraction.run.create`, `evaluation.extraction.run.update` and
 * `evaluation.extraction.run.delete` on project owner/admin, the same people the
 * legacy run policy let in. No schema change, role_permission rows only.
 */
export class EvaluationExtractionRunPermissions1790751641430 implements MigrationInterface {
  name = "EvaluationExtractionRunPermissions1790751641430"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('evaluation.extraction.run.read'),
          ('evaluation.extraction.run.create'),
          ('evaluation.extraction.run.update'),
          ('evaluation.extraction.run.delete')
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
          'evaluation.extraction.run.read',
          'evaluation.extraction.run.create',
          'evaluation.extraction.run.update',
          'evaluation.extraction.run.delete'
        )
    `)
  }
}
