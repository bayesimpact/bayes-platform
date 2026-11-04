import type { MigrationInterface, QueryRunner } from "typeorm"

export class InvitationAgentIds1793717175929 implements MigrationInterface {
  name = "InvitationAgentIds1793717175929"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD "agent_ids" uuid array NOT NULL DEFAULT '{}'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitation" DROP COLUMN "agent_ids"`)
  }
}
