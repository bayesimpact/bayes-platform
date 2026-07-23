import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Migrates every form agent to a conversation agent with the fillForm tool
 * enabled (issue #558: the dedicated form agent type is replaced by a fillForm
 * toggle in agent settings).
 *
 * - Copies ALL form_agent_session rows (top-level sessions, sub-sessions and
 *   soft-deleted rows alike) into conversation_agent_session verbatim, keeping
 *   the same ids. agent_message.session_id, agent_message_feedback,
 *   tester_session_feedback.session_id and reviewer_session_review.session_id
 *   have no FK constraints and reference the preserved ids, so messages,
 *   feedback and campaign reviews follow without being touched.
 * - Sets fill_form_enabled on ALL settings revisions of form agents so history
 *   restore round-trips, and forces documents_rag_mode to 'none' to preserve
 *   behavior: form agents never built the RAG tool, but their settings default
 *   to 'all', which would silently enable document retrieval once they run as
 *   conversation agents.
 * - Runs inside the migration transaction; the count assertions below abort
 *   (and roll back) the whole migration if any row went missing.
 *
 * down() is best-effort: it identifies ex-form agents as those whose every
 * settings revision has fill_form_enabled = true, which is exact right after
 * up() but lossy once native conversation agents enable fillForm (and the
 * original documents_rag_mode values are not restored — they were unused for
 * form agents). The dropped form_agent_session table itself is recreated by
 * reverting the follow-up drop migration first.
 */
export class MigrateFormAgentsToConversation1784816949038 implements MigrationInterface {
  name = "MigrateFormAgentsToConversation1784816949038"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count: formSessionCount }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "form_agent_session"`,
    )
    const [{ count: formResultCount }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "form_agent_session" WHERE "result" IS NOT NULL`,
    )

    // No ON CONFLICT: an id collision (practically impossible) must fail loudly
    // and roll back rather than silently drop a session.
    await queryRunner.query(`
      INSERT INTO "conversation_agent_session"
        ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
         "agent_id", "trace_id", "user_id", "type", "parent_session_id", "campaign_id",
         "result", "title", "expires_at")
      SELECT "id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
             "agent_id", "trace_id", "user_id", "type", "parent_session_id", "campaign_id",
             "result", NULL, NULL
      FROM "form_agent_session"
    `)

    const [{ count: copiedCount }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "conversation_agent_session" "conversation"
       WHERE EXISTS (SELECT 1 FROM "form_agent_session" "form" WHERE "form"."id" = "conversation"."id")`,
    )
    const [{ count: copiedResultCount }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "conversation_agent_session" "conversation"
       WHERE "conversation"."result" IS NOT NULL
         AND EXISTS (SELECT 1 FROM "form_agent_session" "form" WHERE "form"."id" = "conversation"."id")`,
    )
    if (copiedCount !== formSessionCount || copiedResultCount !== formResultCount) {
      throw new Error(
        `Form session copy mismatch: expected ${formSessionCount} sessions ` +
          `(${formResultCount} with a result) but found ${copiedCount} (${copiedResultCount}); rolling back`,
      )
    }

    await queryRunner.query(`
      UPDATE "agent_settings"
      SET "fill_form_enabled" = true, "documents_rag_mode" = 'none'
      WHERE "agent_id" IN (SELECT "id" FROM "agent" WHERE "type" = 'form')
    `)
    await queryRunner.query(`UPDATE "agent" SET "type" = 'conversation' WHERE "type" = 'form'`)
    await queryRunner.query(
      `UPDATE "reviewer_session_review" SET "agent_type" = 'conversation' WHERE "agent_type" = 'form'`,
    )
    await queryRunner.query(
      `UPDATE "tester_session_feedback" SET "agent_type" = 'conversation' WHERE "agent_type" = 'form'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ex-form agents: every settings revision carries fill_form_enabled = true
    // (exact right after up(); best-effort afterwards, see class doc).
    await queryRunner.query(`
      CREATE TEMPORARY TABLE "ex_form_agent" ON COMMIT DROP AS
      SELECT "agent_id" AS "id" FROM "agent_settings"
      GROUP BY "agent_id"
      HAVING bool_and("fill_form_enabled")
    `)

    await queryRunner.query(`
      INSERT INTO "form_agent_session"
        ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
         "agent_id", "trace_id", "user_id", "type", "parent_session_id", "campaign_id", "result")
      SELECT "id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
             "agent_id", "trace_id", "user_id", "type", "parent_session_id", "campaign_id", "result"
      FROM "conversation_agent_session"
      WHERE "agent_id" IN (SELECT "id" FROM "ex_form_agent")
    `)
    await queryRunner.query(`
      DELETE FROM "conversation_agent_session"
      WHERE "agent_id" IN (SELECT "id" FROM "ex_form_agent")
    `)

    await queryRunner.query(`
      UPDATE "agent" SET "type" = 'form'
      WHERE "id" IN (SELECT "id" FROM "ex_form_agent") AND "type" = 'conversation'
    `)
    await queryRunner.query(`
      UPDATE "reviewer_session_review" SET "agent_type" = 'form'
      WHERE "agent_type" = 'conversation'
        AND "session_id" IN (SELECT "id" FROM "form_agent_session")
    `)
    await queryRunner.query(`
      UPDATE "tester_session_feedback" SET "agent_type" = 'form'
      WHERE "agent_type" = 'conversation'
        AND "session_id" IN (SELECT "id" FROM "form_agent_session")
    `)
    await queryRunner.query(`
      UPDATE "agent_settings" SET "fill_form_enabled" = false
      WHERE "agent_id" IN (SELECT "id" FROM "ex_form_agent")
    `)
  }
}
