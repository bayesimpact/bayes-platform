import type { MigrationInterface, QueryRunner } from "typeorm"

const FRENCH_LINE = "## Response language:\nAlways answer in French."
const ENGLISH_LINE = "## Response language:\nAlways answer in English."

/** The line the prompt used to add for the revision's locale, in SQL. */
const LANGUAGE_LINE_SQL = `CASE "settings"."locale" WHEN 'fr' THEN $1 ELSE $2 END`

/** Live conversation agents: extraction agents never read the locale. */
const CONVERSATION_AGENT_SQL = `
  "agent"."id" = "settings"."agent_id"
  AND "agent"."type" = 'conversation'
  AND "agent"."deleted_at" IS NULL
  AND "settings"."deleted_at" IS NULL`

/** Columns a new revision takes over from the published one. */
const COLUMNS_SET_HERE = [
  "id",
  "created_at",
  "updated_at",
  "revision",
  "revision_name",
  "revision_desc",
  "instructions",
  "is_draft",
  "is_archived",
]

/**
 * The answer language now comes from the agent's instructions or the user's messages. So that
 * no agent changes behavior, the line the prompt added for the locale moves into the
 * instructions before the column goes:
 * - a draft gets the line in place;
 * - the newest published revision is copied into a new published revision with the line, and a
 *   draft moves one revision up so it stays the newest.
 * `down()` restores the column, read back from that line ("en" without it). The added lines and
 * revisions stay.
 */
export class DropAgentSettingsLocale1793197135401 implements MigrationInterface {
  name = "DropAgentSettingsLocale1793197135401"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agent_settings" AS "settings"
       SET "instructions" = "settings"."instructions" || E'\\n\\n' || ${LANGUAGE_LINE_SQL},
           "updated_at" = now()
       FROM "agent"
       WHERE ${CONVERSATION_AGENT_SQL} AND "settings"."is_draft" = true`,
      [FRENCH_LINE, ENGLISH_LINE],
    )

    // The newest live published revision of each agent, as the app reads it. The new revision
    // takes the draft's number and the draft the next one, so the numbers stay contiguous;
    // without a draft it takes the next number. Archived and deleted rows count, since the
    // numbers are unique.
    await queryRunner.query(`
      CREATE TEMPORARY TABLE "locale_republish" AS
      SELECT DISTINCT ON ("settings"."agent_id")
        "settings"."id" AS "published_id",
        "settings"."agent_id",
        (SELECT max("other"."revision") FROM "agent_settings" AS "other"
          WHERE "other"."agent_id" = "settings"."agent_id") AS "max_revision",
        (SELECT "draft"."revision" FROM "agent_settings" AS "draft"
          WHERE "draft"."agent_id" = "settings"."agent_id" AND "draft"."is_draft" = true
            AND "draft"."deleted_at" IS NULL) AS "draft_revision"
      FROM "agent_settings" AS "settings", "agent"
      WHERE ${CONVERSATION_AGENT_SQL}
        AND "settings"."is_draft" = false
        AND "settings"."is_archived" = false
      ORDER BY "settings"."agent_id", "settings"."revision" DESC`)

    await queryRunner.query(`
      UPDATE "agent_settings" AS "settings"
      SET "revision" = "republish"."max_revision" + 1
      FROM "locale_republish" AS "republish"
      WHERE "settings"."agent_id" = "republish"."agent_id"
        AND "settings"."is_draft" = true
        AND "settings"."deleted_at" IS NULL`)

    const columns: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT "column_name" FROM "information_schema"."columns"
       WHERE "table_schema" = current_schema() AND "table_name" = 'agent_settings'`,
    )
    const copiedColumns = columns
      .map((column) => column.column_name)
      .filter((columnName) => !COLUMNS_SET_HERE.includes(columnName))
      .map((columnName) => `"${columnName}"`)

    await queryRunner.query(
      `INSERT INTO "agent_settings" (${copiedColumns.join(", ")},
         "revision", "revision_name", "revision_desc", "instructions", "is_draft", "is_archived")
       SELECT ${copiedColumns.map((column) => `"settings".${column}`).join(", ")},
         coalesce("republish"."draft_revision", "republish"."max_revision" + 1),
         'Response language in the instructions',
         'Published automatically when the language setting was removed: the answer language now lives in the instructions.',
         "settings"."instructions" || E'\\n\\n' || ${LANGUAGE_LINE_SQL},
         false,
         false
       FROM "agent_settings" AS "settings"
       JOIN "locale_republish" AS "republish" ON "republish"."published_id" = "settings"."id"`,
      [FRENCH_LINE, ENGLISH_LINE],
    )

    await queryRunner.query(`DROP TABLE "locale_republish"`)
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "locale"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "locale" character varying NOT NULL DEFAULT 'en'`,
    )
    await queryRunner.query(
      `UPDATE "agent_settings" SET "locale" = 'fr' WHERE "instructions" LIKE '%' || $1`,
      [FRENCH_LINE],
    )
  }
}
