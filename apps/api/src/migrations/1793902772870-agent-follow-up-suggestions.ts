import type { MigrationInterface, QueryRunner } from "typeorm"

export class AgentFollowUpSuggestions1793902772870 implements MigrationInterface {
  name = "AgentFollowUpSuggestions1793902772870"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "follow_up_suggestions_enabled" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "follow_up_suggestions_instructions" text`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "follow_up_suggestions_max" integer NOT NULL DEFAULT '2'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "follow_up_suggestions_max"`)
    await queryRunner.query(
      `ALTER TABLE "agent_settings" DROP COLUMN "follow_up_suggestions_instructions"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" DROP COLUMN "follow_up_suggestions_enabled"`,
    )
  }
}
