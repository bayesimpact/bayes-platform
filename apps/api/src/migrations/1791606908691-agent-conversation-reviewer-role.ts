import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Moves the conversation safety review from the `agent_conversation_reviewer` table to a catalog
 * role checked with `@CheckPermission`:
 * - creates the agent-scoped `agent_conversation_reviewer` role holding `agent.conversation.review`;
 * - copies every grant of the table to a `user_membership` row on the `temp_agent` resource
 *   (resource id = agent id), so it adds to the person's single role on the agent;
 * - drops the table.
 * `backoffice.conversation_reviewer.update` on platform_superadmin stays from
 * AgentConversationReviewer1791565987336.
 */
export class AgentConversationReviewerRole1791606908691 implements MigrationInterface {
  name = "AgentConversationReviewerRole1791606908691"

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
      INSERT INTO "user_membership"
        ("user_id", "resource_type", "resource_id", "role", "role_id", "created_at", "updated_at")
      SELECT reviewer.user_id, 'temp_agent', reviewer.agent_id, 'reviewer', role.id,
             reviewer.created_at, reviewer.updated_at
      FROM "agent_conversation_reviewer" AS reviewer
      CROSS JOIN "role" AS role
      WHERE role.key = 'agent_conversation_reviewer'
        AND reviewer.deleted_at IS NULL
      ON CONFLICT DO NOTHING
    `)

    await queryRunner.query(`DROP TABLE "agent_conversation_reviewer"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_conversation_reviewer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "granted_by_user_id" uuid, CONSTRAINT "UQ_agent_conversation_reviewer_user_agent" UNIQUE ("user_id", "agent_id"), CONSTRAINT "PK_604abbf8d8146eea2b78df4be38" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" ADD CONSTRAINT "FK_de230b6c98d86b1b6b87d5c647a" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" ADD CONSTRAINT "FK_d6a0211b16b780ce47f36a91c6c" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" ADD CONSTRAINT "FK_5fb4e1f9ae0603cd5d8909d1928" FOREIGN KEY ("granted_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )

    await queryRunner.query(`
      INSERT INTO "agent_conversation_reviewer" ("user_id", "agent_id", "created_at", "updated_at")
      SELECT membership.user_id, membership.resource_id, membership.created_at, membership.updated_at
      FROM "user_membership" AS membership
      INNER JOIN "agent" ON "agent".id = membership.resource_id
      WHERE membership.resource_type = 'temp_agent'
        AND membership.deleted_at IS NULL
      ON CONFLICT DO NOTHING
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
