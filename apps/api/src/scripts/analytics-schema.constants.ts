/**
 * The `analytics` schema, an operations interface for dashboards
 * (docs/analytics-schema.md): read-only SQL views at the workspace (project)
 * level and above, created by migration 1790148782276-analytics-schema. No
 * user, no session, no message, no content. Not a product entity: these
 * constants serve the contract check (analytics-schema.spec.ts) and the
 * grant script (analytics-readers.ts) only.
 */
export const ANALYTICS_SCHEMA = "analytics"

/** The database role with SELECT on the schema, created by the migration. No login. */
export const ANALYTICS_READER_ROLE = "analytics_reader"

/** Every view of the schema. A new view goes here, or the spec fails. */
export const ANALYTICS_VIEWS = ["projects", "sessions", "messages", "feedback"] as const

/** Columns every view must have: the dashboards filter on them. */
export const ANALYTICS_REQUIRED_COLUMNS = ["organization_id", "project_id"] as const

/**
 * Column names no view may expose, matched on the exact name: identifiers
 * under the workspace, free text, secrets. `agent_id` is allowed: an agent is a
 * configuration of the workspace, not a person.
 */
export const ANALYTICS_FORBIDDEN_COLUMNS = [
  "id",
  "user_id",
  "session_id",
  "message_id",
  "agent_message_id",
  "parent_session_id",
  "document_id",
  "attachment_document_id",
  "external_visitor_id",
  "session_token_hash",
  "embed_token",
  "trace_id",
  "auth0_id",
  "email",
  "content",
  "title",
  "summary",
  "prompt",
  "result",
  "arguments",
  "tool_calls",
  "token",
  "password",
  "secret",
] as const

/** Column name endings no view may expose, whatever the prefix. */
export const ANALYTICS_FORBIDDEN_SUFFIXES = [
  "_content",
  "_text",
  "_token",
  "_token_hash",
  "_password",
  "_secret",
  "_email",
  "_url",
] as const
