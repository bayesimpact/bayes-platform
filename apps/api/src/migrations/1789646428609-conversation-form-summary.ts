import type { MigrationInterface, QueryRunner } from "typeorm"

export class ConversationFormSummary1789646428609 implements MigrationInterface {
  name = "ConversationFormSummary1789646428609"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_form" ADD "summary" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_form" DROP COLUMN "summary"`)
  }
}
