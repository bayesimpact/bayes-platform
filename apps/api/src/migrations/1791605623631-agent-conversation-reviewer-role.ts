import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Conversation safety review, agent by agent:
 * - creates the agent-scoped `agent_conversation_reviewer` role holding `agent.conversation.review`.
 *   It is granted on `temp_agent` rows of `user_membership` (resource id = agent id) so it adds to
 *   the person's single role on the agent. Nobody holds it after this migration.
 * - grants `backoffice.conversation_reviewer.update`, the right to hand that role out from the
 *   backoffice, to platform_superadmin.
 * No schema change: role, role_permission rows only.
 */
export class AgentConversationReviewerRole1791605623631 implements MigrationInterface {
  name = "AgentConversationReviewerRole1791605623631"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      SELECT 'agent_conversation_reviewer', 'Agent Conversation Reviewer', 'agent'
      WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "key" = 'agent_conversation_reviewer')
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.conversation.review'
      FROM "role" AS role
      WHERE role.key = 'agent_conversation_reviewer'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.conversation_reviewer.update'
      FROM "role" AS role
      WHERE role.key = 'platform_superadmin'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_superadmin'
        AND role_permission.permission_key = 'backoffice.conversation_reviewer.update'
    `)

    await queryRunner.query(`DELETE FROM "user_membership" WHERE "resource_type" = 'temp_agent'`)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'agent_conversation_reviewer'
    `)

    await queryRunner.query(`DELETE FROM "role" WHERE "key" = 'agent_conversation_reviewer'`)
  }
}
