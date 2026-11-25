import type { MigrationInterface, QueryRunner } from "typeorm"

export class AttachmentDocumentSession1795643943839 implements MigrationInterface {
  name = "AttachmentDocumentSession1795643943839"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_message_attachment_document" ADD "agent_session_id" uuid`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_message_attachment_document" DROP COLUMN "agent_session_id"`,
    )
  }
}
