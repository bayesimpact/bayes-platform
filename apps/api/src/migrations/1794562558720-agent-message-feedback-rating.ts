import type { MigrationInterface, QueryRunner } from "typeorm"

export class AgentMessageFeedbackRating1794562558720 implements MigrationInterface {
  name = "AgentMessageFeedbackRating1794562558720"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_message_feedback" ADD "rating" character varying NOT NULL DEFAULT 'negative'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_message_feedback" DROP COLUMN "rating"`)
  }
}
