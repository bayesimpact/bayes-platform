import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Project owners and admins can let an app open conversations with the project's agents for
 * people outside the platform: they grant it when they install the app, and only grant what they
 * hold (ADR 0029). `agent.conversation.session.external.create` on project owner/admin; only the
 * apps API checks it. No schema change, role_permission rows only.
 */
export class ProjectExternalConversationPermission1792152000000 implements MigrationInterface {
  name = "ProjectExternalConversationPermission1792152000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.conversation.session.external.create'
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
        AND role_permission.permission_key = 'agent.conversation.session.external.create'
    `)
  }
}
