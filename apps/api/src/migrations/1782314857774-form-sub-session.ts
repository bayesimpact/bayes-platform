import type { MigrationInterface, QueryRunner } from "typeorm"

export class FormSubSession1782314857774 implements MigrationInterface {
  name = "FormSubSession1782314857774"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "form_agent_session" ADD "parent_session_id" uuid`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "form_agent_session" DROP COLUMN "parent_session_id"`)
  }
}
