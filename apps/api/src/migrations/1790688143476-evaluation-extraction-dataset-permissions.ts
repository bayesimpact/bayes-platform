import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Evaluation extraction datasets move to RBAC: `evaluation.extraction.dataset.read`,
 * `evaluation.extraction.dataset.create`, `evaluation.extraction.dataset.update` and
 * `evaluation.extraction.dataset.delete` on project owner/admin, the same people the
 * legacy dataset policy let in. No schema change — role_permission rows only.
 */
export class EvaluationExtractionDatasetPermissions1790688143476 implements MigrationInterface {
  name = "EvaluationExtractionDatasetPermissions1790688143476"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('evaluation.extraction.dataset.read'),
          ('evaluation.extraction.dataset.create'),
          ('evaluation.extraction.dataset.update'),
          ('evaluation.extraction.dataset.delete')
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
          'evaluation.extraction.dataset.read',
          'evaluation.extraction.dataset.create',
          'evaluation.extraction.dataset.update',
          'evaluation.extraction.dataset.delete'
        )
    `)
  }
}
