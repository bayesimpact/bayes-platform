// Builds the configuration of a local oidc-picker (https://github.com/bayesimpact/oidc-picker)
// from the people of a local database: its sign-in page lists them, and a click signs in as that
// person, without a password. sync-users.mjs uses it for the main checkout's picker, and the
// worktree tooling for the picker of each worktree environment. Node built-ins only.
import { execFileSync } from "node:child_process"

export const WEB_CLIENT_ID = "platform-web"

/** The file of the profiles, next to the configuration: the picker reads it again when it changes. */
export const PROFILES_FILE = "profiles.yaml"

// The CORS origins of the API when FRONTEND_URL is empty (apps/api/src/config/cors.ts).
const DEFAULT_FRONTEND_ORIGINS = [
  "https://connect.localhost:5173",
  "https://connect.localhost:5174",
]

const HEADER = `# Generated from the users of a local database. Edits are overwritten the next time
# it is generated (infra/oidc-picker/sync-users.mjs for the main checkout). Not for production use.
`

/**
 * The YAML configuration of a picker with the web app client, its profiles in PROFILES_FILE.
 * - `keysFile`: where the signing keys are kept, so a restart keeps people signed in.
 * - `allowNonLocalIssuer`: an issuer on a domain of yours (DEV_DOMAIN), not *.localhost.
 * - `actorHeader`: the header a gatekeeper in front of the picker sets to the person it signed
 *   in. The picker then refuses requests without it, logs who picked whom, and turns the
 *   password grant off.
 */
export function buildPickerConfig({
  issuer,
  webRedirectUris,
  keysFile,
  allowNonLocalIssuer = false,
  actorHeader,
}) {
  const config = {
    issuer,
    ...(allowNonLocalIssuer ? { allowNonLocalIssuer: true } : {}),
    ...(actorHeader ? { actorHeader } : {}),
    ...(keysFile ? { keysFile } : {}),
    clients: [{ id: WEB_CLIENT_ID, redirectUris: unique(webRedirectUris) }],
    profilesFile: PROFILES_FILE,
  }
  return `${HEADER}${toYaml(config)}\n`
}

/**
 * The profiles of the picker: one per person, signed in with their platform id as `sub` and
 * their stored name, so the first sign-in does not rename the account.
 */
export function buildProfiles(users) {
  const profiles = users.map((user) => ({
    sub: user.id,
    email: user.email,
    name: nameOf(user),
  }))
  return `${HEADER}${profiles.length > 0 ? toYaml({ profiles }) : "profiles: []"}\n`
}

/** The stored name, or the email when there is none. */
export function nameOf(user) {
  return user.name?.trim() || user.email
}

/**
 * The web app origins of FRONTEND_URL, read like the API's CORS outside production
 * (parseFrontendUrls in apps/api/src/config/cors.ts), so the picker accepts the origins the API
 * does.
 */
export function frontendOrigins(frontendUrl) {
  const origins = (frontendUrl ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) =>
      origin.startsWith("http://") || origin.startsWith("https://") ? origin : `https://${origin}`,
    )
  return origins.length > 0 ? origins : [...DEFAULT_FRONTEND_ORIGINS]
}

/**
 * Redirect URIs of the web app (origin plus base path, no trailing slash, like
 * apps/web/src/config/runtime-config.ts getAppUrl). Callers that still pass `bullBoardBaseUrl`
 * get an empty `bullBoard` list.
 */
export function redirectUris({ webOrigins, basePath = "" }) {
  const base = trimSlashes(basePath)
  const web = webOrigins.map((origin) => `${trimTrailingSlash(origin)}${base ? `/${base}` : ""}`)
  return { web, bullBoard: [] }
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
  return JSON.parse(
    execFileSync(
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
    ).trim(),
  )
}

/**
 * A small YAML writer for the plain objects, arrays, strings, numbers and booleans of a picker
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
