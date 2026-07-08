import type { MigrationInterface, QueryRunner } from "typeorm"

export class ConversationSubSession1782389701803 implements MigrationInterface {
  name = "ConversationSubSession1782389701803"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "parent_session_id" uuid`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_agent_session" DROP COLUMN "parent_session_id"`,
    )
  }
}
