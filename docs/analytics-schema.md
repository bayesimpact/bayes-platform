# Analytics schema

The `analytics` schema is what a dashboard tool (Grafana) reads. It holds SQL
views only, at the workspace (project) level and above. Nothing below: no
user, no session, no message id, no content. The views are the contract
between the product and the dashboards; the tables stay private.

It is an operations interface next to the product, not part of it: plain SQL
in one migration, no entity, not registered in TypeORM. The API never reads
it. The in-app Analytics feature (`domains/analytics`) is a different thing:
what a workspace sees of itself, served by the API with its permissions.

## Views

| View | One row per | Columns |
|---|---|---|
| `projects` | live workspace | `project_id`, `name`, `organization_id`, `organization_name`, `conversation_retention_days`, `created_at` |
| `sessions` | session, without its id | `organization_id`, `project_id`, `agent_id`, `channel`, `created_at`, `last_activity_at`, `purged_at`, `status` |
| `messages` | message, as an anonymous event | `organization_id`, `project_id`, `agent_id`, `channel`, `role`, `status`, `created_at`, `started_at`, `completed_at`, `response_seconds`, `tool_call_count`, `has_attachment` |
| `feedback` | user feedback on an answer | `organization_id`, `project_id`, `agent_id`, `created_at` |

`channel` is `public` (embed widget), `live` or `playground` (conversations in
the app), `extraction` (document extraction runs), or `unknown` when the session
is gone. Sub-agent sessions are not counted in `sessions`; their messages are in
`messages` with the channel of their conversation.

## Access

The migration creates the role `analytics_reader` (no login) with `USAGE` on
the schema and `SELECT` on its views, present and future. It has nothing on
`public`. A dashboard tool logs in with its own role, created on the
infrastructure side (`CREATE ROLE grafana_ro LOGIN PASSWORD '...'`), and made
a member of `analytics_reader`:

- On Kubernetes: list the role in the chart value `analyticsReaders.roles`. A
  Job runs `scripts/analytics-readers.ts` after the migrations, on every
  install and upgrade: `GRANT analytics_reader TO <role>` and a
  `statement_timeout` (`analyticsReaders.statementTimeout`, 30 s). Grant only.
  The timeout is best effort: since Postgres 16 `ALTER ROLE` needs the ADMIN
  OPTION on the role, which the platform user has only on roles it created.
  When refused, the Job logs the statement for an administrator and succeeds.
- By hand: `npm run analytics-readers -- --role grafana_ro`, or the two SQL
  statements above as an administrator.
- Locally: `make analytics-dev-role` creates `grafana_ro` and grants it.

## Rules, checked by `scripts/analytics-schema.spec.ts`

- The schema contains exactly the views listed in `ANALYTICS_VIEWS`
  (`apps/api/src/scripts/analytics-schema.constants.ts`), and no table.
- Every view has `organization_id` and `project_id`.
- No view has a column named in `ANALYTICS_FORBIDDEN_COLUMNS` or ending with a
  suffix of `ANALYTICS_FORBIDDEN_SUFFIXES` (`id`, `user_id`, `session_id`,
  `content`, `title`, `tool_calls`, `external_visitor_id`, `_token`, ...).
  `agent_id` is allowed: an agent is a configuration of the workspace.
- The views are not TypeORM entities (no `typeorm_metadata` row), and
  `analytics_reader` cannot log in and has nothing on `public`.

The test reads the database catalog with a plain connection, so a view cannot
expose a column below the workspace level without failing. It needs the
migrations applied on the test database (`npm run migration:test:run`, which
`make tests` and CI do before the suite).

## Changing a view

A new migration with `DROP VIEW` and `CREATE VIEW` (or `CREATE OR REPLACE
VIEW` when columns are only added at the end), written by hand: the views are
SQL, not entities, `migration:generate` does not know them. Postgres refuses
to drop or retype a table column a view depends on: the migration that
changes the table also changes the view, in the same file. Update
`ANALYTICS_VIEWS` when a view is added or removed.

Views are plain views: no storage, always current, computed by the database
the dashboard connects to (the read replica in production). Materialize one
only when it gets slow, without changing its name: the dashboards do not know
the difference.
