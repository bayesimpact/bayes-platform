import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Prompt variables: agents declare {{variables}} in their instructions, and the
 * callers of a session supply their values at session start. The values are
 * stored on the session (public_agent_session, conversation_agent_session) and
 * substituted into the prompt before every model call; agent_settings holds the
 * defaults (versioned with the instructions) every channel falls back to.
 */
export class PromptVariables1792655066179 implements MigrationInterface {
  name = "PromptVariables1792655066179"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "variables" jsonb`)
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "variables" jsonb`)
    await queryRunner.query(`ALTER TABLE "public_agent_session" ADD "variables" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public_agent_session" DROP COLUMN "variables"`)
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "variables"`)
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" DROP COLUMN "variables"`)
  }
}
