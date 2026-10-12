import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Agent message feedback moves to RBAC, with the same people the legacy guards let in:
 * `project.agent_message_feedback.create` on every project role, and
 * `project.agent_message_feedback.read` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectAgentMessageFeedbackPermissions1791534926243 implements MigrationInterface {
  name = "ProjectAgentMessageFeedbackPermissions1791534926243"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.agent_message_feedback.create'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin', 'project_member')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.agent_message_feedback.read'
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
          'project.agent_message_feedback.create',
          'project.agent_message_feedback.read'
        )
    `)
  }
}
