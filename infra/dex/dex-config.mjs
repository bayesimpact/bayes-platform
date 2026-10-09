// Builds the configuration of a local Dex from the people of a local database: one static
// password per human user, all with the same local dev password. sync-users.mjs uses it for
// the main checkout's Dex, and the worktree tooling for the Dex of each worktree environment.
// Node built-ins only.
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

/** Machine-level state of the local dev tooling, outside any checkout. */
export const STATE_DIR = process.env.BAYES_DEV_HOME ?? join(homedir(), ".bayes-worktrees")

/** bcrypt hash of the local dev password, shared by every local Dex of the machine. */
export const PASSWORD_HASH_FILE = join(STATE_DIR, "dex-password.bcrypt")

export const WEB_CLIENT_ID = "platform-web"
export const BULL_BOARD_CLIENT_ID = "bull-board"
export const BULL_BOARD_CLIENT_SECRET = "local-bull-board-secret"

// The origins of config.sample.yaml, kept so a generated config still serves them.
export const SAMPLE_WEB_REDIRECT_URIS = [
  "https://connect.localhost:5173",
  "https://connect.localhost:5174",
  "http://localhost:5173",
  "https://connect.localhost:3000",
]
export const SAMPLE_BULL_BOARD_REDIRECT_URIS = [
  "https://connect.localhost:3000/api/internal/bull-board/oauth/callback",
]

const HEADER = `# Generated from the users of a local database. Edits are overwritten the next time
# it is generated (infra/dex/sync-users.mjs for the main checkout). Not for production use.
`

/**
 * The YAML configuration of a Dex with in-memory storage, the web app and Bull Board clients,
 * and one static password per user. Dex matches redirect URIs exactly, so every origin the
 * web app runs on is listed.
 */
export function buildDexConfig({
  issuer,
  listenAddress,
  webRedirectUris,
  bullBoardRedirectUris,
  users,
  passwordHash,
}) {
  const config = {
    issuer,
    storage: { type: "memory" },
    web: { http: listenAddress, allowedOrigins: ["*"] },
    oauth2: { skipApprovalScreen: true, passwordConnector: "local" },
    enablePasswordDB: true,
    staticClients: [
      {
        id: WEB_CLIENT_ID,
        name: "Platform web app",
        public: true,
        redirectURIs: unique(webRedirectUris),
      },
      {
        id: BULL_BOARD_CLIENT_ID,
        name: "Bull Board dashboard",
        secret: BULL_BOARD_CLIENT_SECRET,
        redirectURIs: unique(bullBoardRedirectUris),
      },
    ],
    staticPasswords: users.map((user) => ({
      email: user.email,
      hash: passwordHash,
      username: usernameOf(user),
      userID: user.id,
    })),
  }
  return `${HEADER}${toYaml(config)}\n`
}

/**
 * Dex sends the username as the `name` claim, and the API copies it onto the account it links
 * at the first sign-in: keep the stored name, or fall back to the email.
 */
export function usernameOf(user) {
  return user.name?.trim() || user.email
}

/**
 * Redirect URIs of the web app (origin plus base path, no trailing slash, like
 * apps/web/src/config/runtime-config.ts getAppUrl) and of Bull Board's callback.
 */
export function redirectUris({ webOrigins, basePath = "", bullBoardBaseUrl, bullBoardRoute }) {
  const base = trimSlashes(basePath)
  const web = webOrigins.map((origin) => `${trimTrailingSlash(origin)}${base ? `/${base}` : ""}`)
  const route = trimSlashes(bullBoardRoute || "internal/bull-board")
  const bullBoard = bullBoardBaseUrl
    ? [`${trimTrailingSlash(bullBoardBaseUrl)}/api/${route}/oauth/callback`]
    : []
  return { web, bullBoard }
}

/** The pgvector container of the shared dev stack, found by its compose labels. */
export function findPostgresContainer() {
  const names = execFileSync(
    "docker",
    [
      "ps",
      "--filter",
      "label=com.docker.compose.project=connect-db",
      "--filter",
      "label=com.docker.compose.service=pgvector",
      "--format",
      "{{.Names}}",
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
  if (names.length !== 1) {
    throw new Error(
      "The shared Postgres (compose project connect-db) is not running: start it from the main checkout with `cd infra/database && docker compose up -d`.",
    )
  }
  return names[0]
}

/** Human, non-deleted users of a database, as { id, email, name }. */
export function readHumanUsers({ container, database }) {
  const sql = `SELECT coalesce(json_agg(json_build_object('id', id, 'email', email, 'name', name) ORDER BY email), '[]')
FROM "user" WHERE type = 'human' AND deleted_at IS NULL AND coalesce(email, '') <> '';`
  return JSON.parse(psql({ container, database, sql }))
}

/**
 * bcrypt hash of the dev password, computed by pgcrypto in the shared Postgres so the tooling
 * needs no dependency. The statement is kept out of the server log (log_statement=all).
 */
export function hashPassword({ container, password }) {
  const literal = password.replaceAll("'", "''")
  const sql = `SET log_statement = 'none';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SELECT crypt('${literal}', gen_salt('bf', 10));`
  const hash = psql({ container, database: "postgres", sql }).split("\n").at(-1)
  if (!/^\$2[aby]\$\d\d\$/u.test(hash ?? "")) {
    throw new Error("pgcrypto did not return a bcrypt hash")
  }
  return hash
}

function psql({ container, database, sql }) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "admin",
      "-d",
      database,
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8" },
  ).trim()
}

/**
 * A small YAML writer for the plain objects, arrays, strings, numbers and booleans of a Dex
 * configuration. Strings are written as JSON strings, which are valid double-quoted YAML.
 */
export function toYaml(value, indent = "") {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        isPlainObject(item)
          ? `${indent}- ${toYaml(item, `${indent}  `).slice(indent.length + 2)}`
          : `${indent}- ${scalar(item)}`,
      )
      .join("\n")
  }
  return Object.entries(value)
    .map(([key, entry]) => {
      if (isPlainObject(entry) || (Array.isArray(entry) && entry.length > 0)) {
        return `${indent}${key}:\n${toYaml(entry, `${indent}  `)}`
      }
      return `${indent}${key}: ${Array.isArray(entry) ? "[]" : scalar(entry)}`
    })
    .join("\n")
}

function scalar(value) {
  return typeof value === "boolean" || typeof value === "number"
    ? String(value)
    : JSON.stringify(String(value))
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function unique(values) {
  return [...new Set(values)]
}

function trimTrailingSlash(url) {
  return url.replace(/\/+$/u, "")
}

function trimSlashes(path) {
  return path.trim().replace(/^\/+/u, "").replace(/\/+$/u, "")
}
