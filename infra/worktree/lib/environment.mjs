// The values a worktree environment runs with: the compose variables of
// infra/worktree/.env, and the keys rewritten in the worktree's own .env files so that commands
// run on the host (tests, migrations, scripts) use the environment's databases and Redis.
// Pure functions only.

/** The node_modules folders that infra/worktree/docker-compose.yaml mounts a volume on. */
export const TEMPLATE_NODE_MODULES_FOLDERS = [
  "",
  "apps/api",
  "apps/cli",
  "apps/help",
  "apps/web",
  "apps/web-embed",
  "packages/api-contracts",
  "packages/jest-config",
  "packages/ui",
]

export const DEFAULT_SMTP_FROM = "Platform <no-reply@connect.localhost>"

/** Variables of infra/worktree/.env, read by docker compose. */
export function composeVariables({
  names,
  worktreePath,
  uid,
  gid,
  routerPort,
  redisPort,
  sourceDatabase,
  gcpCredentials,
  gcsBucket,
  smtpFrom,
  lockHash,
  dexDir,
}) {
  return {
    COMPOSE_PROJECT_NAME: names.project,
    WT_SLUG: names.slug,
    WT_PATH: worktreePath,
    WT_UID: String(uid),
    WT_GID: String(gid),
    WT_ROUTER_PORT: String(routerPort),
    WT_REDIS_PORT: String(redisPort),
    WT_DB: names.database,
    WT_DB_TEST: names.testDatabase,
    WT_DB_SOURCE: sourceDatabase,
    WT_ORIGIN: names.origin,
    WT_EMBED_ORIGIN: names.embedOrigin,
    WT_HELP_ORIGIN: names.helpOrigin,
    WT_DEX_ISSUER: names.dexIssuer,
    WT_DEX_DIR: dexDir,
    WT_GCP_CREDENTIALS: gcpCredentials.hostPath,
    WT_GCP_CREDENTIALS_IN_CONTAINER: gcpCredentials.inContainer,
    WT_GCS_BUCKET: gcsBucket ?? "",
    WT_SMTP_FROM: smtpFrom || DEFAULT_SMTP_FROM,
    WT_LOCK_HASH: lockHash,
  }
}

/** A compose .env file. Values are single-quoted, which compose reads literally. */
export function formatComposeEnv(variables) {
  const lines = [
    "# Written by `npm run wt -- up` for docker compose. Edits are overwritten.",
    ...Object.entries(variables).map(([key, value]) => {
      if (/[\n']/u.test(value)) throw new Error(`${key} cannot hold a quote or a line break`)
      return `${key}='${value}'`
    }),
  ]
  return `${lines.join("\n")}\n`
}

/** Values of a compose .env file written by formatComposeEnv. */
export function parseComposeEnv(text) {
  const values = {}
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)='(.*)'$/u)
    if (match) values[match[1]] = match[2]
  }
  return values
}

/** The same connection URL, on another database. */
export function withDatabase(url, database) {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

/**
 * Keys to set in the worktree's own env files, for host commands. The containers get theirs
 * from compose, which wins over these files.
 */
export function hostEnvValues({ names, redisPort, gcpCredentials, testDatabaseUrl }) {
  const api = {
    DATABASE_NAME: names.database,
    // TypeORM prefers DATABASE_URL: when the file sets one, empty it.
    DATABASE_URL: "",
    BULLMQ_REDIS_URL: `redis://127.0.0.1:${redisPort}`,
  }
  if (gcpCredentials.inContainer) api.GOOGLE_APPLICATION_CREDENTIALS = gcpCredentials.hostPath
  const apiTest = testDatabaseUrl
    ? { DATABASE_URL: withDatabase(testDatabaseUrl, names.testDatabase) }
    : {}
  return { api, apiTest }
}

/** Folders of package-lock.json whose node_modules the compose template does not mount. */
export function missingNodeModulesVolumes(folders) {
  return folders.filter((folder) => !TEMPLATE_NODE_MODULES_FOLDERS.includes(folder))
}
