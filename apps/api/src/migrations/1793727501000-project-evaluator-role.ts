import type { MigrationInterface, QueryRunner } from "typeorm"

const EVALUATION_PERMISSIONS = [
  "evaluation.ui.read",
  "evaluation.extraction.dataset.read",
  "evaluation.extraction.dataset.create",
  "evaluation.extraction.dataset.update",
  "evaluation.extraction.dataset.delete",
  "evaluation.extraction.run.read",
  "evaluation.extraction.run.create",
  "evaluation.extraction.run.update",
  "evaluation.extraction.run.delete",
  "evaluation.conversation.dataset.read",
  "evaluation.conversation.dataset.create",
  "evaluation.conversation.dataset.update",
  "evaluation.conversation.dataset.delete",
  "evaluation.conversation.run.read",
  "evaluation.conversation.run.create",
  "evaluation.conversation.run.update",
  "evaluation.conversation.run.delete",
]

const EVALUATOR_PERMISSIONS = [
  "project.read",
  "agent.read",
  "agent.draft.read",
  "agent.settings.draft.read",
  ...EVALUATION_PERMISSIONS,
]

const sqlList = (values: string[]) => values.map((value) => `'${value}'`).join(", ")

/**
 * Replaces the `evaluation` feature flag with the project-scoped `project_evaluator` role:
 * - creates the role, holding the evaluation app, its datasets and runs, and the agents with
 *   their drafts;
 * - gives it to the owners and admins of every project that had the flag on;
 * - takes the evaluation permissions away from `project_owner` and `project_admin`;
 * - deletes the flag rows.
 * No schema change.
 */
export class ProjectEvaluatorRole1793727501000 implements MigrationInterface {
  name = "ProjectEvaluatorRole1793727501000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      SELECT 'project_evaluator', 'Project Evaluator', 'project'
      WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "key" = 'project_evaluator')
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN unnest(ARRAY[${sqlList(EVALUATOR_PERMISSIONS)}]) AS permission (key)
      WHERE role.key = 'project_evaluator'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_grant" ("user_id", "resource_type", "resource_id", "role_id")
      SELECT DISTINCT holder.user_id, 'project', holder.resource_id, evaluator.id
      FROM "feature_flag" AS flag
      JOIN "role_grant" AS holder
        ON holder.resource_type = 'project'
        AND holder.resource_id = flag.project_id
        AND holder.deleted_at IS NULL
      JOIN "role" AS holder_role
        ON holder_role.id = holder.role_id
        AND holder_role.key IN ('project_owner', 'project_admin')
      CROSS JOIN "role" AS evaluator
      WHERE evaluator.key = 'project_evaluator'
        AND flag.feature_flag_key = 'evaluation'
        AND flag.enabled = true
        AND flag.deleted_at IS NULL
      ON CONFLICT DO NOTHING
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN (${sqlList(EVALUATION_PERMISSIONS)})
    `)

    await queryRunner.query(`DELETE FROM "feature_flag" WHERE "feature_flag_key" = 'evaluation'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "feature_flag" ("project_id", "feature_flag_key", "enabled")
      SELECT DISTINCT evaluator_grant.resource_id, 'evaluation', true
      FROM "role_grant" AS evaluator_grant
      JOIN "role" AS role ON role.id = evaluator_grant.role_id
      JOIN "project" ON "project".id = evaluator_grant.resource_id
      WHERE role.key = 'project_evaluator'
        AND evaluator_grant.deleted_at IS NULL
      ON CONFLICT DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN unnest(ARRAY[${sqlList(EVALUATION_PERMISSIONS)}]) AS permission (key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      DELETE FROM "role_grant" AS role_grant
      USING "role" AS role
      WHERE role_grant.role_id = role.id
        AND role.key = 'project_evaluator'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'project_evaluator'
    `)

    await queryRunner.query(`DELETE FROM "role" WHERE "key" = 'project_evaluator'`)
  }
}
