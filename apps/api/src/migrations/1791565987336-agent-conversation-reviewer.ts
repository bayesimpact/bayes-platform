import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Conversation safety review: the people allowed to read any conversation of one agent from its
 * session id, granted agent by agent from the backoffice. Nobody is in the table after this
 * migration. Also grants `backoffice.conversation_reviewer.update`, the right to hand that out,
 * to platform_superadmin (role_permission row only).
 */
export class AgentConversationReviewer1791565987336 implements MigrationInterface {
  name = "AgentConversationReviewer1791565987336"

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" DROP CONSTRAINT "FK_5fb4e1f9ae0603cd5d8909d1928"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" DROP CONSTRAINT "FK_d6a0211b16b780ce47f36a91c6c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_conversation_reviewer" DROP CONSTRAINT "FK_de230b6c98d86b1b6b87d5c647a"`,
    )
    await queryRunner.query(`DROP TABLE "agent_conversation_reviewer"`)
  }
}
