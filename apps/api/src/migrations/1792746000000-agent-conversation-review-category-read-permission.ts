import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Grants `agent.conversation.review.category.read` to the `agent_conversation_reviewer` role:
 * the safety reviewer who can read a conversation from its session id can also list the
 * agent's sessions grouped by category.
 */
export class AgentConversationReviewCategoryReadPermission1792746000000
  implements MigrationInterface
{
  name = "AgentConversationReviewCategoryReadPermission1792746000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.conversation.review.category.read'
      FROM "role" AS role
      WHERE role.key = 'agent_conversation_reviewer'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'agent_conversation_reviewer'
        AND role_permission.permission_key = 'agent.conversation.review.category.read'
    `)
  }
}
