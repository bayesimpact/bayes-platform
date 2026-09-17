import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The forms of a conversation move from a `result` column on each session
 * table to one `conversation_form` row per (session, agent). Schema generated
 * from the entities; the two INSERT ... SELECT statements carry the existing
 * form states over, stamped with the settings revision of the session's last
 * assistant message (or, failing that, the agent's latest published revision).
 */
export class ConversationForms1789630241709 implements MigrationInterface {
  name = "ConversationForms1789630241709"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversation_form" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "session_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "agent_settings_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'in_progress', "state" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_1336fea8d0d5ce6378bc06cd85f" UNIQUE ("organization_id", "project_id", "session_id", "agent_id"), CONSTRAINT "PK_fe774d55fa7a17b946716aa3f94" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_form" ADD CONSTRAINT "FK_464daec9b3710b88476fb8d4ecf" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_form" ADD CONSTRAINT "FK_77ae1c577129bb97a67478ff6fa" FOREIGN KEY ("agent_settings_id") REFERENCES "agent_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    // Existing form states: one row per session that has one, attributed to
    // the session's agent. Sessions whose agent has no settings row at all
    // (none in practice) keep nothing.
    for (const sessionTable of ["conversation_agent_session", "public_agent_session"]) {
      await queryRunner.query(`
        INSERT INTO "conversation_form"
          ("organization_id", "project_id", "session_id", "agent_id", "agent_settings_id",
           "status", "state", "created_at", "updated_at", "deleted_at")
        SELECT
          "session"."organization_id", "session"."project_id", "session"."id", "session"."agent_id",
          COALESCE(
            (SELECT "message"."agent_settings_id" FROM "agent_message" "message"
              WHERE "message"."session_id" = "session"."id" AND "message"."role" = 'assistant'
              ORDER BY "message"."created_at" DESC LIMIT 1),
            (SELECT "settings"."id" FROM "agent_settings" "settings"
              WHERE "settings"."agent_id" = "session"."agent_id" AND "settings"."is_draft" = false
              ORDER BY "settings"."revision" DESC LIMIT 1),
            (SELECT "settings"."id" FROM "agent_settings" "settings"
              WHERE "settings"."agent_id" = "session"."agent_id"
              ORDER BY "settings"."revision" DESC LIMIT 1)
          ),
          'in_progress', "session"."result", "session"."created_at", "session"."updated_at", "session"."deleted_at"
        FROM "${sessionTable}" "session"
        WHERE "session"."result" IS NOT NULL
          AND EXISTS (SELECT 1 FROM "agent_settings" "any" WHERE "any"."agent_id" = "session"."agent_id")
      `)
    }

    await queryRunner.query(`ALTER TABLE "conversation_agent_session" DROP COLUMN "result"`)
    await queryRunner.query(`ALTER TABLE "public_agent_session" DROP COLUMN "result"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public_agent_session" ADD "result" jsonb`)
    await queryRunner.query(`ALTER TABLE "conversation_agent_session" ADD "result" jsonb`)
    // Back to one state per session: the form of the session's own agent.
    for (const sessionTable of ["conversation_agent_session", "public_agent_session"]) {
      await queryRunner.query(`
        UPDATE "${sessionTable}" "session"
        SET "result" = "form"."state"
        FROM "conversation_form" "form"
        WHERE "form"."session_id" = "session"."id" AND "form"."agent_id" = "session"."agent_id"
      `)
    }
    await queryRunner.query(
      `ALTER TABLE "conversation_form" DROP CONSTRAINT "FK_77ae1c577129bb97a67478ff6fa"`,
    )
    await queryRunner.query(
      `ALTER TABLE "conversation_form" DROP CONSTRAINT "FK_464daec9b3710b88476fb8d4ecf"`,
    )
    await queryRunner.query(`DROP TABLE "conversation_form"`)
  }
}
