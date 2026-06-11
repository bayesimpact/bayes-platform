import type { MigrationInterface, QueryRunner } from "typeorm"

export class RenameSessionTypeToAgentType1781194730596 implements MigrationInterface {
  name = "RenameSessionTypeToAgentType1781194730596"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviewer_session_review" RENAME COLUMN "session_type" TO "agent_type"`,
    )
    await queryRunner.query(
      `ALTER TABLE "tester_session_feedback" RENAME COLUMN "session_type" TO "agent_type"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tester_session_feedback" RENAME COLUMN "agent_type" TO "session_type"`,
    )
    await queryRunner.query(
      `ALTER TABLE "reviewer_session_review" RENAME COLUMN "agent_type" TO "session_type"`,
    )
  }
}
