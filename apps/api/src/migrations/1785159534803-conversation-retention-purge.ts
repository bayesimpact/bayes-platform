import type { MigrationInterface, QueryRunner } from "typeorm"

export class ConversationRetentionPurge1785159534803 implements MigrationInterface {
  name = "ConversationRetentionPurge1785159534803"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project" ADD "conversation_retention_days" integer`)
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "purged_at" TIMESTAMP`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" DROP COLUMN "purged_at"`)
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "conversation_retention_days"`)
  }
}
