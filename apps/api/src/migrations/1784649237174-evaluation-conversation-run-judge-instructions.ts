import type { MigrationInterface, QueryRunner } from "typeorm"

export class EvaluationConversationRunJudgeInstructions1784649237174 implements MigrationInterface {
  name = "EvaluationConversationRunJudgeInstructions1784649237174"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" ADD "judge_instructions" text`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run" DROP COLUMN "judge_instructions"`,
    )
  }
}
