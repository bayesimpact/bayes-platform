import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Conversation sessions move to RBAC, with the same people the legacy session policy let in:
 * `agent.conversation.session.read`, `.create` and `.delete` (live sessions) on every project
 * role, and `agent.conversation.session.playground.read`, `.create` and `.delete` on project
 * owner/admin only. No schema change, role_permission rows only.
 */
export class ConversationAgentSessionPermissions1791374647253 implements MigrationInterface {
  name = "ConversationAgentSessionPermissions1791374647253"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.conversation.session.read'),
          ('agent.conversation.session.create'),
          ('agent.conversation.session.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin', 'project_member')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.conversation.session.playground.read'),
          ('agent.conversation.session.playground.create'),
          ('agent.conversation.session.playground.delete')
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
        AND role.key IN ('project_owner', 'project_admin', 'project_member')
        AND role_permission.permission_key IN (
          'agent.conversation.session.read',
          'agent.conversation.session.create',
          'agent.conversation.session.delete',
          'agent.conversation.session.playground.read',
          'agent.conversation.session.playground.create',
          'agent.conversation.session.playground.delete'
        )
    `)
  }
}
