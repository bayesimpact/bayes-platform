import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Evaluation conversation datasets move to RBAC: `evaluation.conversation.dataset.read`,
 * `evaluation.conversation.dataset.create`, `evaluation.conversation.dataset.update` and
 * `evaluation.conversation.dataset.delete` on project owner/admin, the same people the
 * legacy dataset policy let in. No schema change, role_permission rows only.
 */
export class EvaluationConversationDatasetPermissions1790757833180 implements MigrationInterface {
  name = "EvaluationConversationDatasetPermissions1790757833180"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('evaluation.conversation.dataset.read'),
          ('evaluation.conversation.dataset.create'),
          ('evaluation.conversation.dataset.update'),
          ('evaluation.conversation.dataset.delete')
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
          'evaluation.conversation.dataset.read',
          'evaluation.conversation.dataset.create',
          'evaluation.conversation.dataset.update',
          'evaluation.conversation.dataset.delete'
        )
    `)
  }
}
