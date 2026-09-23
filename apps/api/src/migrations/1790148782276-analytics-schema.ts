import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The `analytics` schema: read-only SQL views for dashboards, at the
 * workspace level and above (docs/analytics-schema.md). An operations
 * interface next to the product, not part of it: plain SQL, no entity, not
 * registered in TypeORM (no typeorm_metadata row), so synchronize and
 * migration:generate ignore the views. The contract is checked by
 * scripts/analytics-schema.spec.ts against the database catalog.
 *
 * The role `analytics_reader` reads this schema and nothing else. A dashboard
 * tool logs in with its own role, member of it (the chart's analyticsReaders
 * job). The role is created once per database instance: it needs CREATEROLE
 * on the migration user.
 *
 * To change a view: a new migration with DROP VIEW and CREATE VIEW. Postgres
 * refuses to drop or retype a table column a view depends on: the migration
 * that changes the table changes the view too.
 */
export class AnalyticsSchema1790148782276 implements MigrationInterface {
  name = "AnalyticsSchema1790148782276"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "analytics"`)
    await queryRunner.query(`CREATE VIEW "analytics"."sessions" AS 
    SELECT s.organization_id,
           s.project_id,
           s.agent_id,
           'public'::varchar AS channel,
           s.created_at,
           s.last_activity_at,
           s.purged_at,
           NULL::varchar AS status
    FROM public_agent_session s
    UNION ALL
    SELECT s.organization_id,
           s.project_id,
           s.agent_id,
           s.type AS channel,
           s.created_at,
           NULL AS last_activity_at,
           s.purged_at,
           NULL::varchar AS status
    FROM conversation_agent_session s
    WHERE s.parent_session_id IS NULL
    UNION ALL
    SELECT s.organization_id,
           s.project_id,
           s.agent_id,
           'extraction'::varchar AS channel,
           s.created_at,
           NULL AS last_activity_at,
           NULL AS purged_at,
           s.status
    FROM extraction_agent_session s
  `)
    await queryRunner.query(`CREATE VIEW "analytics"."projects" AS 
    SELECT p.id AS project_id,
           p.name,
           p.organization_id,
           o.name AS organization_name,
           p.conversation_retention_days,
           p.created_at
    FROM project p
    JOIN organization o ON o.id = p.organization_id
    WHERE p.deleted_at IS NULL
  `)
    await queryRunner.query(`CREATE VIEW "analytics"."messages" AS 
    SELECT m.organization_id,
           m.project_id,
           st.agent_id,
           COALESCE(s.channel, 'unknown')::varchar AS channel,
           m.role,
           m.status,
           m.created_at,
           m.started_at,
           m.completed_at,
           EXTRACT(EPOCH FROM (m.completed_at - m.started_at))::double precision AS response_seconds,
           CASE WHEN jsonb_typeof(m.tool_calls) = 'array' THEN jsonb_array_length(m.tool_calls) ELSE 0 END AS tool_call_count,
           (m.attachment_document_id IS NOT NULL) AS has_attachment
    FROM agent_message m
    LEFT JOIN agent_settings st ON st.id = m.agent_settings_id
    LEFT JOIN (
      SELECT id, 'public'::varchar AS channel FROM public_agent_session
      UNION ALL
      SELECT id, type AS channel FROM conversation_agent_session
      UNION ALL
      SELECT id, 'extraction'::varchar AS channel FROM extraction_agent_session
    ) s ON s.id = m.session_id
  `)
    await queryRunner.query(`CREATE VIEW "analytics"."feedback" AS 
    SELECT f.organization_id,
           f.project_id,
           st.agent_id,
           f.created_at
    FROM agent_message_feedback f
    LEFT JOIN agent_message m ON m.id = f.agent_message_id
    LEFT JOIN agent_settings st ON st.id = m.agent_settings_id
  `)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_reader') THEN
          CREATE ROLE analytics_reader NOLOGIN;
        END IF;
      END
      $$`)
    await queryRunner.query(`GRANT USAGE ON SCHEMA "analytics" TO analytics_reader`)
    await queryRunner.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "analytics" TO analytics_reader`)
    // Views created by later migrations (same migration user) are readable too.
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "analytics" GRANT SELECT ON TABLES TO analytics_reader`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "analytics"."feedback"`)
    await queryRunner.query(`DROP VIEW "analytics"."messages"`)
    await queryRunner.query(`DROP VIEW "analytics"."projects"`)
    await queryRunner.query(`DROP VIEW "analytics"."sessions"`)
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "analytics" REVOKE SELECT ON TABLES FROM analytics_reader`,
    )
    await queryRunner.query(`REVOKE ALL ON SCHEMA "analytics" FROM analytics_reader`)
    await queryRunner.query(`DROP SCHEMA "analytics"`)
    await queryRunner.query(`DROP ROLE IF EXISTS analytics_reader`)
  }
}
