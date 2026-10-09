import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Conversation safety review: creates the global `conversation_reviewer` role holding
 * `agent.conversation.review` (read any conversation of an agent from its session id), and
 * grants `backoffice.user.role.update` to platform_superadmin so it can hand that role out
 * from the backoffice. Nobody holds `conversation_reviewer` after this migration.
 */
export class ConversationReviewerRole1791563512072 implements MigrationInterface {
  name = "ConversationReviewerRole1791563512072"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      SELECT 'conversation_reviewer', 'Conversation Reviewer', 'global'
      WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "key" = 'conversation_reviewer')
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.conversation.review'
      FROM "role" AS role
      WHERE role.key = 'conversation_reviewer'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.user.role.update'
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
        AND role_permission.permission_key = 'backoffice.user.role.update'
    `)

    await queryRunner.query(`
      DELETE FROM "user_membership" AS membership
      USING "role" AS role
      WHERE membership.role_id = role.id
        AND role.key = 'conversation_reviewer'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'conversation_reviewer'
    `)

    await queryRunner.query(`DELETE FROM "role" WHERE "key" = 'conversation_reviewer'`)
  }
}
