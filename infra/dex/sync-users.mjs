#!/usr/bin/env node
// Moves the people of your local database to the local Dex, so you sign in to the main
// checkout with your email and a local dev password, and keep every account and its data.
//
//   node infra/dex/sync-users.mjs [--password <dev password>] [--dry-run] [--no-env] [--no-restart]
//
// Run it from the main checkout, once, then again when people are added to the database. It
// writes infra/dex/config.local.yaml (git-ignored), points apps/api/.env and apps/web/.env.local
// at Dex (each backed up once next to it), and recreates the dex container of infra/database.
// Nothing is written to the database: at the first sign-in, the API links each account to its
// Dex identity by verified email (docs/adr/0021-generic-oidc-and-access-by-email.md).
//
// The dev password is hashed once and kept in ~/.bayes-worktrees/dex-password.bcrypt, which the
// worktree environments reuse. Pass --password (or set DEX_DEV_PASSWORD) to change it.
import { execFileSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import {
  BULL_BOARD_CLIENT_ID,
  BULL_BOARD_CLIENT_SECRET,
  buildDexConfig,
  findPostgresContainer,
  hashPassword,
  PASSWORD_HASH_FILE,
  readHumanUsers,
  redirectUris,
  SAMPLE_BULL_BOARD_REDIRECT_URIS,
  SAMPLE_WEB_REDIRECT_URIS,
  STATE_DIR,
  WEB_CLIENT_ID,
} from "./dex-config.mjs"
import { readEnvValues, setEnvValues } from "./env-file.mjs"

// The port is part of the issuer: infra/database/docker-compose.yaml publishes Dex on 5556.
const ISSUER = "http://localhost:5556/dex"
const REPO = fileURLToPath(new URL("../..", import.meta.url))
const CONFIG_FILE = join(REPO, "infra/dex/config.local.yaml")
const API_ENV_FILE = join(REPO, "apps/api/.env")
const WEB_ENV_FILE = join(REPO, "apps/web/.env.local")
const ENV_COMMENT = "Local Dex (infra/dex/sync-users.mjs)"

const { values: options } = parseArgs({
  options: {
    password: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "no-env": { type: "boolean", default: false },
    "no-restart": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
})

if (options.help) {
  console.log(`Usage: node infra/dex/sync-users.mjs [options]

  --password    Local dev password of every user (default: the saved one, else asked)
  --dry-run     Print the users and redirect URIs, write nothing
  --no-env      Leave apps/api/.env and apps/web/.env.local untouched
  --no-restart  Do not recreate the dex container`)
  process.exit(0)
}

try {
  await main()
} catch (error) {
  console.error(`\n${error.message}`)
  process.exit(1)
}

async function main() {
  assertMainCheckout()
  if (!existsSync(API_ENV_FILE)) throw new Error(`${API_ENV_FILE} is missing.`)
  const apiEnv = readEnvValues(readFileSync(API_ENV_FILE, "utf8"))
  const webEnv = {
    ...readEnvIfPresent(join(REPO, "apps/web/.env")),
    ...readEnvIfPresent(WEB_ENV_FILE),
  }
  const database = apiEnv.DATABASE_NAME || "connect"
  const container = findPostgresContainer()
  const users = readHumanUsers({ container, database })
  if (users.length === 0) {
    throw new Error(`No human user in the database ${database}: nothing to sign in with.`)
  }

  const frontendOrigins = (apiEnv.FRONTEND_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  const derived = redirectUris({
    webOrigins: frontendOrigins,
    basePath: webEnv.VITE_BASE_PATH,
    bullBoardBaseUrl: apiEnv.BULL_BOARD_BASE_URL,
    bullBoardRoute: apiEnv.BULL_BOARD_ROUTE,
  })
  const webRedirectUris = [...SAMPLE_WEB_REDIRECT_URIS, ...derived.web]
  const bullBoardRedirectUris = [...SAMPLE_BULL_BOARD_REDIRECT_URIS, ...derived.bullBoard]

  console.log(`Database ${database}: ${users.length} people`)
  for (const user of users) console.log(`  ${user.email}`)
  console.log(`Web app redirect URIs: ${[...new Set(webRedirectUris)].join(", ")}`)
  console.log(`Bull Board redirect URIs: ${[...new Set(bullBoardRedirectUris)].join(", ")}`)
  if (options["dry-run"]) return

  const passwordHash = await resolvePasswordHash(container)
  const config = buildDexConfig({
    issuer: ISSUER,
    listenAddress: "0.0.0.0:5556",
    webRedirectUris,
    bullBoardRedirectUris,
    users,
    passwordHash,
  })
  const configChanged = writeIfChanged(CONFIG_FILE, config)
  console.log(`${configChanged ? "Wrote" : "Unchanged:"} infra/dex/config.local.yaml`)

  if (!options["no-env"]) pointMainCheckoutAtDex()
  if (!options["no-restart"]) {
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        join(REPO, "infra/database/docker-compose.yaml"),
        "--profile",
        "dex",
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "dex",
      ],
      { stdio: "inherit" },
    )
  }

  console.log(`
Done. Restart the API and the web app (npm run dev), then sign in with your email and the dev
password. On the dev VM, forward port 5556 to your laptop (VS Code does it, or ssh -L 5556:localhost:5556).`)
}

function assertMainCheckout() {
  const [gitDir, commonDir] = execFileSync(
    "git",
    ["-C", REPO, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
  if (gitDir !== commonDir) {
    throw new Error(
      "Run this script from the main checkout: it configures the Dex and the .env files of the main checkout.",
    )
  }
}

async function resolvePasswordHash(container) {
  const password = options.password ?? process.env.DEX_DEV_PASSWORD
  if (password === undefined && existsSync(PASSWORD_HASH_FILE)) {
    return readFileSync(PASSWORD_HASH_FILE, "utf8").trim()
  }
  const chosen = password ?? (await askPassword())
  if (chosen.length < 8) throw new Error("The dev password needs at least 8 characters.")
  const hash = hashPassword({ container, password: chosen })
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(PASSWORD_HASH_FILE, `${hash}\n`, { mode: 0o600 })
  chmodSync(PASSWORD_HASH_FILE, 0o600)
  return hash
}

async function askPassword() {
  if (!process.stdin.isTTY) {
    throw new Error("No dev password saved yet: pass --password or set DEX_DEV_PASSWORD.")
  }
  const first = await readHidden("Local dev password for every user: ")
  const second = await readHidden("Same password again: ")
  if (first !== second) throw new Error("The two passwords differ.")
  return first
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt)
    let typed = ""
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") {
          cleanUp()
          process.stdout.write("\n")
          resolve(typed)
          return
        }
        if (character === "\u0003") {
          cleanUp()
          reject(new Error("Cancelled."))
          return
        }
        typed = character === "\u007f" ? typed.slice(0, -1) : typed + character
      }
    }
    const cleanUp = () => {
      process.stdin.off("data", onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on("data", onData)
  })
}

function pointMainCheckoutAtDex() {
  editEnvFile(API_ENV_FILE, {
    values: {
      OIDC_ISSUER_URL: ISSUER,
      OIDC_AUDIENCE: "",
      OIDC_AUTHORIZATION_PARAMS: "",
      WEB_OIDC_CLIENT_ID: WEB_CLIENT_ID,
      // Only cleared when set: they would send the web app to another provider.
      WEB_OIDC_AUTHORITY: "",
      WEB_OIDC_AUDIENCE: "",
      WEB_OIDC_AUTHORIZATION_PARAMS: "",
      BULL_BOARD_OIDC_CLIENT_ID: BULL_BOARD_CLIENT_ID,
      BULL_BOARD_OIDC_CLIENT_SECRET: BULL_BOARD_CLIENT_SECRET,
    },
    onlyExisting: ["WEB_OIDC_AUTHORITY", "WEB_OIDC_AUDIENCE", "WEB_OIDC_AUTHORIZATION_PARAMS"],
  })
  editEnvFile(WEB_ENV_FILE, {
    values: {
      VITE_OIDC_AUTHORITY: ISSUER,
      VITE_OIDC_CLIENT_ID: WEB_CLIENT_ID,
      VITE_OIDC_AUDIENCE: "",
      VITE_OIDC_AUTHORIZATION_PARAMS: "",
    },
  })
  // Vite ranks .env.development and .env.development.local above .env.local.
  for (const name of [".env.development", ".env.development.local"]) {
    const values = readEnvIfPresent(join(REPO, "apps/web", name))
    if (values.VITE_OIDC_AUTHORITY !== undefined || values.VITE_OIDC_CLIENT_ID !== undefined) {
      console.warn(
        `Warning: apps/web/${name} sets VITE_OIDC_* and wins over .env.local: remove them from it.`,
      )
    }
  }
}

function editEnvFile(path, { values, onlyExisting }) {
  const before = existsSync(path) ? readFileSync(path, "utf8") : ""
  const after = setEnvValues(before, values, { comment: ENV_COMMENT, onlyExisting })
  if (after === before) {
    console.log(`Unchanged: ${relative(path)}`)
    return
  }
  // One backup, from before the first switch (git-ignored through *dontsave*).
  const backup = `${path}.dontsave-before-dex`
  if (before !== "" && !existsSync(backup)) copyFileSync(path, backup)
  writeFileSync(path, after)
  console.log(`Updated ${relative(path)}${before !== "" ? ` (backup: ${relative(backup)})` : ""}`)
}

function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false
  writeFileSync(path, content)
  return true
}

function readEnvIfPresent(path) {
  return existsSync(path) ? readEnvValues(readFileSync(path, "utf8")) : {}
}

function relative(path) {
  return path.startsWith(REPO) ? path.slice(REPO.length) : path
}
