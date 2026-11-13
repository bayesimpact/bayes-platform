import type { MigrationInterface, QueryRunner } from "typeorm"

export class EvaluationConversationRunFormState1794568142502 implements MigrationInterface {
  name = "EvaluationConversationRunFormState1794568142502"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" ADD "form_state" jsonb`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_run_record" DROP COLUMN "form_state"`,
    )
  }
}
