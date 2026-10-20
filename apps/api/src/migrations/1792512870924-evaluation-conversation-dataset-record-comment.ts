import type { MigrationInterface, QueryRunner } from "typeorm"

export class EvaluationConversationDatasetRecordComment1792512870924 implements MigrationInterface {
  name = "EvaluationConversationDatasetRecordComment1792512870924"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_dataset_record" ADD "comment" text`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_conversation_dataset_record" DROP COLUMN "comment"`,
    )
  }
}
