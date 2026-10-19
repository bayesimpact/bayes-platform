#!/usr/bin/env node
// Lists the people of your local database in the local oidc-picker, so you sign in to the main
// checkout by clicking your name, and keep every account and its data.
//
//   node infra/oidc-picker/sync-users.mjs [--dry-run] [--no-env] [--no-restart]
//
// Run it from the main checkout, once, then again when people are added to the database or the
// URLs of the .env files change. It writes infra/oidc-picker/config.local.yaml and
// profiles.yaml (git-ignored), points apps/api/.env and apps/web/.env.local at the picker (each
// backed up once next to it), and recreates the oidc-picker container of infra/database when its
// configuration changed. New people only need the profiles: the picker reads them again.
// Nothing is written to the database: at the first sign-in, the API links each account to its
// identity by verified email (docs/adr/0021-generic-oidc-and-access-by-email.md).
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { readEnvValues, setEnvValues } from "./env-file.mjs"
import {
  buildPickerConfig,
  buildProfiles,
  findPostgresContainer,
  frontendOrigins,
  PROFILES_FILE,
  readHumanUsers,
  redirectUris,
  WEB_CLIENT_ID,
} from "./picker-config.mjs"

// The port is part of the issuer: infra/database/docker-compose.yaml publishes the picker on 5556.
const ISSUER = "http://localhost:5556"
const REPO = fileURLToPath(new URL("../..", import.meta.url))
const FOLDER = join(REPO, "infra/oidc-picker")
const CONFIG_FILE = join(FOLDER, "config.local.yaml")
const PROFILES_PATH = join(FOLDER, PROFILES_FILE)
const API_ENV_FILE = join(REPO, "apps/api/.env")
const WEB_ENV_FILE = join(REPO, "apps/web/.env.local")
const ENV_COMMENT = "Local oidc-picker (infra/oidc-picker/sync-users.mjs)"

const { values: options } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    "no-env": { type: "boolean", default: false },
    "no-restart": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
})

if (options.help) {
  console.log(`Usage: node infra/oidc-picker/sync-users.mjs [options]

  --dry-run     Print the users and redirect URIs, write nothing
  --no-env      Leave apps/api/.env and apps/web/.env.local untouched
  --no-restart  Do not recreate the oidc-picker container`)
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
    throw new Error(
      `No human user in the database ${database} yet. Add yourself with \`npm run platform-role -w apps/api -- grant --email <your email> --role platform_superadmin\`, then run this script again.`,
    )
  }

  const { web: webRedirectUris } = redirectUris({
    webOrigins: frontendOrigins(apiEnv.FRONTEND_URL),
    basePath: webEnv.VITE_BASE_PATH,
  })

  console.log(`Database ${database}: ${users.length} people`)
  for (const user of users) console.log(`  ${user.email}`)
  console.log(`Web app redirect URIs: ${[...new Set(webRedirectUris)].join(", ")}`)
  if (options["dry-run"]) return

  const profilesChanged = writeIfChanged(PROFILES_PATH, buildProfiles(users))
  console.log(`${profilesChanged ? "Wrote" : "Unchanged:"} infra/oidc-picker/${PROFILES_FILE}`)
  const configChanged = writeIfChanged(
    CONFIG_FILE,
    buildPickerConfig({ issuer: ISSUER, webRedirectUris }),
  )
  console.log(`${configChanged ? "Wrote" : "Unchanged:"} infra/oidc-picker/config.local.yaml`)

  if (!options["no-env"]) pointMainCheckoutAtPicker()
  if (!options["no-restart"]) {
    removeFormerDex()
    // Recreated only when its configuration changed: it reads new profiles by itself.
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        join(REPO, "infra/database/docker-compose.yaml"),
        "--profile",
        "oidc-picker",
        "up",
        "-d",
        ...(configChanged ? ["--force-recreate"] : []),
        "--no-deps",
        "oidc-picker",
      ],
      { stdio: "inherit" },
    )
  }

  console.log(`
Done. Restart the API and the web app (npm run dev), then sign in by clicking your name. On the
dev VM, forward port 5556 to your laptop (VS Code does it, or ssh -L 5556:localhost:5556).`)
}

/**
 * The Dex the shared stack ran before the picker: its service is gone from the compose file, but
 * its container stays and holds port 5556, which the picker takes.
 */
function removeFormerDex() {
  const containers = execFileSync(
    "docker",
    [
      "ps",
      "-aq",
      "--filter",
      "label=com.docker.compose.project=connect-db",
      "--filter",
      "label=com.docker.compose.service=dex",
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
  if (containers.length === 0) return
  execFileSync("docker", ["rm", "-f", ...containers], { stdio: "ignore" })
  console.log("Removed the former Dex of the shared stack, which held port 5556.")
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
      "Run this script from the main checkout: it configures the oidc-picker and the .env files of the main checkout.",
    )
  }
}

function pointMainCheckoutAtPicker() {
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
  const backup = `${path}.dontsave-before-oidc-picker`
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
