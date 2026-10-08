#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process"
// Dev environments of git worktrees. Each worktree gets its own containers (web app, API,
// workers, Storybooks, Grafana, Dex...), databases copied from the local one and URLs on
// http://<worktree>.connect.localhost:8800. See infra/worktree/README.md.
//
//   npm run wt -- <command> [options]
//
// Run `npm run wt -- help` for the commands. Node built-ins only.
import { createHash } from "node:crypto"
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statfsSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { homedir, totalmem } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import {
  buildDexConfig,
  PASSWORD_HASH_FILE,
  readHumanUsers,
  redirectUris,
  STATE_DIR,
} from "../dex/dex-config.mjs"
import { readEnvValues, setEnvValues } from "../dex/env-file.mjs"
import { decide, MAX_REMOVALS_PER_RUN, parseWorktreeList } from "./lib/cleanup.mjs"
import {
  composeVariables,
  formatComposeEnv,
  hostEnvValues,
  missingNodeModulesVolumes,
  parseComposeEnv,
  TEMPLATE_NODE_MODULES_FOLDERS,
} from "./lib/environment.mjs"
import { environmentNames, isDatabaseOf, nodeModulesFolders, slugProblem } from "./lib/naming.mjs"
import { currentBranch, pullRequestOf, readStatus, updateStatus } from "./lib/status.mjs"
import {
  databaseNames,
  isPortFree,
  listContainers,
  psql,
  readJson,
  repositoryPaths,
  run,
  runVisible,
  sharedCompose,
  sharedContainer,
  throughRouter,
  withLock,
  writeFileAtomic,
} from "./lib/system.mjs"

const COMPOSE_FILE = "infra/worktree/docker-compose.yaml"
const ONE_SHOT_SERVICES = new Set(["init", "db", "migrate"])
const NODE_SERVICES = [
  "contracts",
  "api",
  "workers",
  "web",
  "embed",
  "help",
  "storybook-web",
  "storybook-ui",
  "storybook-embed",
]
// Services of the shared stack an environment uses, with their compose profile.
const SHARED_SERVICES = [
  ["pgvector", null],
  ["redis", null],
  ["traefik", "router"],
  ["dev-dashboard", "router"],
  ["otel-collector", "traces"],
  ["phoenix", "traces"],
  ["mailpit", "mail"],
]
const TRASH_DAYS = 14
const CONFIG_FILE = join(STATE_DIR, "config.json")
const CLEANUP_LOG = join(STATE_DIR, "cleanup.log")
const CLEANUP_STAMP = join(STATE_DIR, "cleanup.stamp")
const CLEANUP_EVERY_MS = 10 * 60 * 1000

const HELP = `Dev environments of git worktrees (infra/worktree/README.md).

In a worktree:
  up [--skip-host-install]   Create or update the environment of this worktree, then print its URLs
  down                       Remove it: containers, volumes and databases (a dump is kept ${TRASH_DAYS} days)
  logs [service] [--follow]  Logs of the environment, or of one service (api, workers, web...)
  restart [service]          Restart the environment, or one service
  stop | start               Pause the environment (it stays paused across reboots), resume it
  reset-db                   Replace its databases with a fresh copy of the main checkout's
  dex-sync                   Give Dex accounts to people added to its database since it started

Anywhere:
  status                     List the environments of this machine
  cleanup [--apply]          Environments whose pull request is merged or closed: what would be
                             removed (environment, databases, worktree, branch), or remove them
    [--include-unregistered] Also worktrees without an environment
    [--enable-auto | --disable-auto]  Let the session start hook remove them by itself
  setup [--recreate]         Once per machine: caches, shared stack and router
  doctor                     Check this machine
  down --slug <name>         Remove the environment of a worktree that no longer exists`

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    follow: { type: "boolean", short: "f", default: false },
    slug: { type: "string" },
    recreate: { type: "boolean", default: false },
    "skip-host-install": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    auto: { type: "boolean", default: false },
    "include-unregistered": { type: "boolean", default: false },
    "enable-auto": { type: "boolean", default: false },
    "disable-auto": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

const [command = "help", argument] = positionals
const commands = {
  up: () => up(),
  down: () => down(),
  logs: () => composeCommand(["logs", "--tail", "200", ...(options.follow ? ["--follow"] : [])]),
  restart: () => composeCommand(["restart"]),
  stop: () => composeCommand(["stop"]),
  start: () => composeCommand(["start"]),
  "reset-db": () => resetDatabases(),
  "dex-sync": () => dexSync(),
  status: () => status(),
  cleanup: () => cleanup(),
  "session-start": () => sessionStart(),
  setup: () => setup(),
  doctor: () => doctor(),
  help: () => console.log(HELP),
}

if (options.help || !(command in commands)) {
  console.log(HELP)
  process.exit(options.help || command === "help" ? 0 : 1)
}

try {
  await commands[command]()
} catch (error) {
  console.error(`\n${error.message}`)
  process.exit(1)
}

// --- Commands --------------------------------------------------------------------------------

async function up() {
  const environment = currentEnvironment()
  const startedAt = Date.now()
  await withLock(environment.slug, async () => {
    const postgres = ensureSharedStack(environment.mainCheckout)
    const passwordHash = dexPasswordHash()
    checkNodeModulesVolumes(environment)
    refuseForeignProject(environment)

    const composeEnvFile = join(environment.root, "infra/worktree/.env")
    const previous = existsSync(composeEnvFile)
      ? parseComposeEnv(readFileSync(composeEnvFile, "utf8"))
      : {}
    const redisPort = await chooseRedisPort(environment, previous)
    const gcp = gcpCredentials(environment)
    const lockHash = sha256(readFileSync(join(environment.root, "package-lock.json")))
    const people = writeDexConfig(environment, postgres, passwordHash)
    const variables = composeVariables({
      names: environment.names,
      worktreePath: environment.root,
      uid: process.getuid(),
      gid: process.getgid(),
      routerPort: environment.routerPort,
      redisPort,
      sourceDatabase: environment.mainApiEnv.DATABASE_NAME || "connect",
      gcpCredentials: gcp,
      gcsBucket: environment.mainApiEnv.GCS_STORAGE_BUCKET_NAME,
      smtpFrom: environment.mainApiEnv.SMTP_FROM,
      lockHash,
      dexDir: environment.stateDir,
    })
    writeFileAtomic(composeEnvFile, formatComposeEnv(variables))

    prepareMountPoints(environment)
    copyMissingEnvFiles(environment)
    pointHostEnvFilesAtEnvironment(environment, { redisPort, gcp })
    if (!options["skip-host-install"]) installHostDependencies(environment, lockHash)

    if (previous.WT_LOCK_HASH && previous.WT_LOCK_HASH !== lockHash) {
      console.log("package-lock.json changed: the dev servers stop while the init reinstalls.")
      compose(environment, ["stop", ...NODE_SERVICES])
    }
    console.log(`Starting ${environment.names.project} (Dex accounts: ${people} people)...`)
    if (compose(environment, ["up", "-d", "--remove-orphans"]) !== 0) {
      throw new Error("docker compose up failed, see above.")
    }
    await waitUntilReady(environment)
    await waitForRoutes(environment)
    recordStatus(environment)
    printSummary(environment, startedAt)
  })
}

async function down() {
  const target = options.slug ? environmentOfSlug(options.slug) : currentEnvironment()
  await withLock(target.slug, () => removeEnvironment(target))
}

/** Containers, volumes, databases (after a dump), Phoenix project and state of an environment. */
async function removeEnvironment(target) {
  const postgres = sharedContainer("pgvector")
  if (postgres && databaseNames(postgres).includes(target.names.database)) {
    const dump = dumpDatabase(postgres, target.names.database, target.slug)
    console.log(`Kept a dump of ${target.names.database} for ${TRASH_DAYS} days: ${dump}`)
  }
  runVisible("docker", [
    "compose",
    "-p",
    target.names.project,
    "down",
    "--volumes",
    "--remove-orphans",
  ])
  // Whatever compose did not find, for example after the project was renamed.
  const leftovers = listContainers([`label=dev.worktree.slug=${target.slug}`]).map(
    (container) => container.ID,
  )
  if (leftovers.length > 0) run("docker", ["rm", "--force", ...leftovers])
  const volumes = run("docker", [
    "volume",
    "ls",
    "--quiet",
    "--filter",
    `label=com.docker.compose.project=${target.names.project}`,
  ])
    .split("\n")
    .filter(Boolean)
  if (volumes.length > 0) run("docker", ["volume", "rm", "--force", ...volumes])
  dropDatabases(postgres, target.slug)
  // Phoenix answers 404 for a project that never got a trace: nothing to report.
  await throughRouter(
    target.routerPort,
    `phoenix.connect.localhost:${target.routerPort}`,
    `/v1/projects/${target.names.phoenixProject}`,
    "DELETE",
  )
  rmSync(join(STATE_DIR, "envs", target.slug), { recursive: true, force: true })
  updateStatus(target.slug, null)
  pruneTrash()
  console.log(`Removed the environment ${target.slug}.`)
}

async function resetDatabases() {
  const environment = currentEnvironment()
  await withLock(environment.slug, async () => {
    const postgres = ensureSharedStack(environment.mainCheckout)
    compose(environment, ["stop", "api", "workers", "grafana"])
    if (databaseNames(postgres).includes(environment.names.database)) {
      console.log(
        `Kept a dump: ${dumpDatabase(postgres, environment.names.database, environment.slug)}`,
      )
    }
    dropDatabases(postgres, environment.slug)
  })
  await up()
}

function dexSync() {
  const environment = currentEnvironment()
  const postgres = ensureSharedStack(environment.mainCheckout)
  const people = writeDexConfig(environment, postgres, dexPasswordHash())
  compose(environment, ["restart", "dex"])
  console.log(`Dex of ${environment.slug} restarted with ${people} people. Sign in again.`)
}

function composeCommand(args) {
  const target = options.slug ? environmentOfSlug(options.slug) : currentEnvironment()
  const code = runVisible("docker", [
    "compose",
    "-p",
    target.names.project,
    ...args,
    ...(argument ? [argument] : []),
  ])
  if (code !== 0) process.exit(code)
}

function status() {
  const containers = listContainers(["label=dev.worktree.slug"])
  const known = readStatus().environments ?? {}
  if (containers.length === 0) {
    console.log(
      "No worktree environment on this machine. Start one with /worktree <name> in Claude Code.",
    )
    return
  }
  const bySlug = Map.groupBy(containers, (container) => container.Labels["dev.worktree.slug"])
  for (const [slug, group] of [...bySlug].sort(([first], [second]) =>
    first.localeCompare(second),
  )) {
    const longRunning = group.filter((container) => !ONE_SHOT_SERVICES.has(service(container)))
    const ready = longRunning.filter(
      (container) => container.State === "running" && !/unhealthy|starting/u.test(container.Status),
    )
    const details = known[slug] ?? {}
    const routerPort = Number(readMainStackEnv().ROUTER_PORT || 8800)
    console.log(
      [
        slug.padEnd(24),
        `${ready.length}/${longRunning.length} ready`.padEnd(12),
        (details.branch ?? "").padEnd(36),
        environmentNames(slug, routerPort).origin,
      ].join(" "),
    )
    const problems = group.filter(
      (container) =>
        /unhealthy|Restarting/u.test(container.Status) ||
        (ONE_SHOT_SERVICES.has(service(container)) && /Exited \([1-9]/u.test(container.Status)),
    )
    for (const container of problems) console.log(`    ${service(container)}: ${container.Status}`)
  }
}

async function setup() {
  assertSupportedPlatform()
  run("docker", ["version", "--format", "{{.Server.Version}}"])
  const { mainCheckout } = repositoryPaths()
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  for (const volume of ["bayes-dev-npm-cache", "bayes-dev-go-cache"]) {
    run("docker", ["volume", "create", "--label", "dev.worktree.cache=true", volume])
  }
  const profiles = ["router", "traces", "mail"].flatMap((profile) => ["--profile", profile])
  const code = runVisible(
    "docker",
    sharedCompose(mainCheckout, [
      ...profiles,
      "up",
      "-d",
      ...(options.recreate ? [] : ["--no-recreate"]),
    ]),
  )
  if (code !== 0) throw new Error("Could not start the shared stack, see above.")
  const postgres = sharedContainer("pgvector")
  ensureGrafanaRole(postgres)
  if (!existsSync(PASSWORD_HASH_FILE)) {
    console.log(`
Next: run \`node infra/dex/sync-users.mjs\` from the main checkout. It sets the local dev password
and moves the people of your database to Dex.`)
  }
  console.log(`
On the dev VM, forward port ${readMainStackEnv().ROUTER_PORT || 8800} (worktree environments) and 5556
(the main checkout's Dex) to your laptop: VS Code does it with the settings of the repository, or
ssh -L 8800:localhost:8800 -L 5556:localhost:5556 <vm>. Then open http://dev.connect.localhost:8800
in Chrome or Firefox.`)
  await doctor()
}

async function doctor() {
  const checks = []
  const check = (ok, label, advice = "") => checks.push({ ok, label, advice })
  check(
    process.platform !== "win32",
    `platform ${process.platform}`,
    "Windows: later, through WSL2",
  )
  let dockerOk = true
  try {
    run("docker", ["info", "--format", "{{.ServerVersion}}"])
  } catch {
    dockerOk = false
  }
  check(dockerOk, "Docker answers", "start Docker (Docker Desktop on a Mac)")
  if (dockerOk) {
    for (const [name] of SHARED_SERVICES) {
      check(Boolean(sharedContainer(name)), `shared ${name} runs`, "npm run wt -- setup")
    }
    const routerPort = Number(readMainStackEnv().ROUTER_PORT || 8800)
    const code = await throughRouter(routerPort, `dev.connect.localhost:${routerPort}`, "/healthz")
    check(code === 200, `router answers on 127.0.0.1:${routerPort}`, "npm run wt -- setup")
    const memory = Number(run("docker", ["info", "--format", "{{.MemTotal}}"]))
    check(
      memory >= 12 * 1024 ** 3,
      `Docker memory ${(memory / 1024 ** 3).toFixed(1)} GB (about 6 GB per environment)`,
      "raise it in Docker Desktop settings",
    )
  }
  check(existsSync(PASSWORD_HASH_FILE), "local dev password set", "node infra/dex/sync-users.mjs")
  const disk = statfsSync(homedir())
  const freeGb = (disk.bavail * disk.bsize) / 1024 ** 3
  check(
    freeGb > 20,
    `${freeGb.toFixed(0)} GB free on disk (about 2 GB per environment)`,
    "free disk space",
  )
  if (process.platform === "linux") {
    const instances = Number(readFileSync("/proc/sys/fs/inotify/max_user_instances", "utf8"))
    check(
      instances >= 512,
      `inotify max_user_instances ${instances}`,
      "sudo sysctl fs.inotify.max_user_instances=1024 (each dev server takes one)",
    )
  }
  try {
    run("gh", ["auth", "status"])
    check(true, "gh signed in (pull request status)")
  } catch {
    check(false, "gh signed in (pull request status)", "gh auth login")
  }
  check(
    totalmem() > 8 * 1024 ** 3,
    `${(totalmem() / 1024 ** 3).toFixed(0)} GB of RAM on this machine`,
  )
  for (const { ok, label, advice } of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label}${ok || !advice ? "" : `: ${advice}`}`)
  }
}

async function cleanup() {
  const { mainCheckout } = repositoryPaths()
  if (options["enable-auto"] || options["disable-auto"]) {
    writeConfig({ ...readConfig(), autoCleanup: Boolean(options["enable-auto"]) })
    console.log(
      options["enable-auto"]
        ? "The session start hook now removes the environments whose pull request is merged or closed."
        : "The session start hook now only reports what it would remove.",
    )
    return
  }
  const apply = options.apply || (options.auto && readConfig().autoCleanup === true)
  const say = options.auto ? () => {} : (line) => console.log(line)
  const checkedAt = new Date().toISOString()
  let removals = 0
  for (const facts of cleanupFacts(mainCheckout)) {
    const decision = decide(facts)
    if (facts.hasEnvironment && facts.worktreeExists) {
      updateStatus(facts.slug, {
        cleanup: { verdict: decision.action, reason: decision.reason, checkedAt },
      })
    }
    if (decision.action === "keep") {
      if (decision.reason !== "gone") say(`keep    ${facts.slug}: ${decision.reason}`)
      continue
    }
    if (decision.action === "remove" && !facts.hasEnvironment && !options["include-unregistered"]) {
      say(
        `report  ${facts.slug}: ${decision.reason}, no environment (--include-unregistered removes it)`,
      )
      continue
    }
    const what =
      decision.action === "remove"
        ? "environment, databases, worktree and branch"
        : "environment and databases"
    if (!apply) {
      say(`would remove ${facts.slug} (${what}): ${decision.reason}`)
      continue
    }
    if (removals >= MAX_REMOVALS_PER_RUN) {
      say(`Stopped after ${MAX_REMOVALS_PER_RUN} removals: run it again for the next ones.`)
      break
    }
    removals += 1
    try {
      await withLock(facts.slug, () => removeWorktreeAndEnvironment(facts, decision, mainCheckout))
      logCleanup({ slug: facts.slug, action: decision.action, reason: decision.reason })
    } catch (error) {
      logCleanup({ slug: facts.slug, action: "failed", reason: error.message })
      console.error(`Could not remove ${facts.slug}: ${error.message}`)
    }
  }
  if (!apply && !options.auto) {
    console.log("\nNothing was removed. --apply removes what is listed as would remove.")
  }
}

async function removeWorktreeAndEnvironment(facts, decision, mainCheckout) {
  if (facts.hasEnvironment) await removeEnvironment(environmentOfSlug(facts.slug, mainCheckout))
  if (decision.action !== "remove") return
  // Without --force: git refuses a worktree with modified or untracked files.
  run("git", ["-C", mainCheckout, "worktree", "remove", facts.path])
  const tip = run("git", [
    "-C",
    mainCheckout,
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${facts.branch}`,
  ])
  if (tip === facts.head) run("git", ["-C", mainCheckout, "branch", "-D", facts.branch])
  updateStatus(facts.slug, null)
  console.log(`Removed the worktree ${facts.path} and the branch ${facts.branch}.`)
}

/** Everything decide() needs about each worktree of the repository and each environment. */
function cleanupFacts(mainCheckout) {
  const now = Date.now()
  const ghAvailable = isGhSignedIn()
  const environmentPaths = new Map()
  for (const container of listContainers(["label=dev.worktree.slug"])) {
    environmentPaths.set(
      container.Labels["dev.worktree.path"],
      container.Labels["dev.worktree.slug"],
    )
  }
  const facts = []
  const worktrees = parseWorktreeList(
    run("git", ["-C", mainCheckout, "worktree", "list", "--porcelain"]),
  ).filter((worktree) => worktree.path !== mainCheckout)
  for (const worktree of worktrees) {
    const slug = basename(worktree.path)
    const base = {
      slug,
      path: worktree.path,
      branch: worktree.branch,
      head: worktree.head,
      locked: worktree.locked,
      isAgentWorktree: slug.startsWith("agent-"),
      worktreeExists: !worktree.prunable && existsSync(worktree.path),
      hasEnvironment: environmentPaths.has(worktree.path),
      ghAvailable,
      now,
    }
    environmentPaths.delete(worktree.path)
    if (
      !base.worktreeExists ||
      base.isAgentWorktree ||
      base.locked ||
      !base.branch ||
      !ghAvailable
    ) {
      facts.push(base)
      continue
    }
    const pr = pullRequestOf(worktree.branch, worktree.path)
    if (!pr || pr.state === "OPEN") {
      facts.push({ ...base, pr })
      continue
    }
    facts.push({
      ...base,
      pr,
      dirty: isDirty(worktree.path),
      headInPullRequest: isInPullRequest(worktree.path, worktree.head, pr.headRefOid),
      inUse: isInUse(worktree.path),
      lastActivityAt: lastGitActivity(worktree.path),
    })
  }
  // Environments whose worktree git no longer knows (folder deleted, then pruned).
  for (const [path, slug] of environmentPaths) {
    facts.push({
      slug,
      path,
      worktreeExists: false,
      hasEnvironment: true,
      isAgentWorktree: false,
      now,
    })
  }
  return facts
}

function isGhSignedIn() {
  try {
    run("gh", ["auth", "status"])
    return true
  } catch {
    return false
  }
}

function isDirty(path) {
  return (
    run("git", [
      "-C",
      path,
      "--no-optional-locks",
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]) !== ""
  )
}

/** HEAD is the pull request's last commit, or an ancestor of it. */
function isInPullRequest(path, head, pullRequestHead) {
  if (head === pullRequestHead) return true
  try {
    run("git", ["-C", path, "cat-file", "-e", `${pullRequestHead}^{commit}`])
    run("git", ["-C", path, "merge-base", "--is-ancestor", head, pullRequestHead])
    return true
  } catch {
    return false
  }
}

/**
 * Whether a process of this machine works in the worktree: a Claude session, a shell, an
 * editor. The environment's own containers run there too, so processes of another mount
 * namespace (containers) do not count.
 */
function isInUse(path) {
  if (process.platform === "linux") {
    const ownNamespace = readlinkSync("/proc/self/ns/mnt")
    for (const pid of readdirSync("/proc").filter((name) => /^\d+$/u.test(name))) {
      try {
        if (readlinkSync(`/proc/${pid}/ns/mnt`) !== ownNamespace) continue
        const cwd = readlinkSync(`/proc/${pid}/cwd`)
        if (cwd === path || cwd.startsWith(`${path}/`)) return true
      } catch {
        // A process that ended, or of another user.
      }
    }
    return false
  }
  try {
    return run("lsof", ["-a", "-d", "cwd", "-u", String(process.getuid()), "-Fn"])
      .split("\n")
      .some((line) => line === `n${path}` || line.startsWith(`n${path}/`))
  } catch {
    return true
  }
}

/** The last change of the worktree's index or HEAD (commits, checkouts, staging). */
function lastGitActivity(path) {
  const gitDir = run("git", ["-C", path, "rev-parse", "--absolute-git-dir"])
  return Math.max(
    ...["index", "HEAD", "logs/HEAD"].map((name) => {
      try {
        return statSync(join(gitDir, name)).mtimeMs
      } catch {
        return 0
      }
    }),
  )
}

function readConfig() {
  return readJson(CONFIG_FILE, {})
}

function writeConfig(config) {
  writeFileAtomic(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 0o600)
}

function logCleanup(entry) {
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  appendFileSync(CLEANUP_LOG, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

/**
 * The SessionStart hook (.claude/settings.json): a reminder of the environment of this
 * worktree, or of /worktree in the main checkout, then a cleanup in the background, at most
 * every 10 minutes. Prints nothing on machines that never set the tooling up.
 */
function sessionStart() {
  if (process.platform === "win32" || !existsSync(STATE_DIR)) return
  let paths
  try {
    paths = repositoryPaths()
  } catch {
    return
  }
  const routerPort = Number(readMainStackEnv(paths.mainCheckout).ROUTER_PORT || 8800)
  if (paths.isMain) {
    const environments = Object.keys(readStatus().environments ?? {}).length
    console.log(
      `Worktree environments of this machine: ${environments}, at http://dev.connect.localhost:${routerPort}. To start work in a new worktree with its own environment (URLs, databases, Dex): /worktree <name>.`,
    )
    for (const line of recentCleanups()) console.log(line)
  } else {
    const slug = basename(paths.root)
    const names = environmentNames(slug, routerPort)
    if (existsSync(join(paths.root, "infra/worktree/.env"))) {
      console.log(
        `This worktree runs its own environment at ${names.origin} (npm run wt -- status). Commands run here (tests, migrations, scripts) use its databases ${names.database} and ${names.testDatabase}. Never start npm run dev, the workers or a Storybook here: the environment runs them. Logs: npm run wt -- logs <service>.`,
      )
    } else if (!slug.startsWith("agent-") && !slugProblem(slug)) {
      console.log(`This worktree has no environment yet: npm run wt -- up starts one.`)
    }
  }
  startCleanupInBackground(paths.mainCheckout)
}

function recentCleanups() {
  if (!existsSync(CLEANUP_LOG)) return []
  const since = Date.now() - 24 * 60 * 60 * 1000
  return readFileSync(CLEANUP_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => Date.parse(entry.at) > since)
    .map((entry) =>
      entry.action === "failed"
        ? `Cleanup could not remove ${entry.slug}: ${entry.reason}`
        : `Cleanup removed ${entry.slug} (${entry.reason}).`,
    )
}

function startCleanupInBackground(mainCheckout) {
  const script = join(mainCheckout, "infra/worktree/wt.mjs")
  if (!existsSync(script)) return
  if (
    existsSync(CLEANUP_STAMP) &&
    Date.now() - statSync(CLEANUP_STAMP).mtimeMs < CLEANUP_EVERY_MS
  ) {
    return
  }
  if (existsSync(CLEANUP_STAMP)) {
    const time = new Date()
    utimesSync(CLEANUP_STAMP, time, time)
  } else {
    writeFileSync(CLEANUP_STAMP, "")
  }
  const output = openSync(join(STATE_DIR, "cleanup-output.log"), "a")
  spawn(process.execPath, [script, "cleanup", "--auto"], {
    cwd: mainCheckout,
    detached: true,
    stdio: ["ignore", output, output],
  }).unref()
}

// --- Environment ------------------------------------------------------------------------------

function assertSupportedPlatform() {
  if (process.platform === "win32") {
    throw new Error(
      "Worktree environments run on Linux and macOS for now (Windows: later, through WSL2).",
    )
  }
}

function currentEnvironment() {
  assertSupportedPlatform()
  const paths = repositoryPaths()
  if (paths.isMain) {
    throw new Error(
      "Run it in a worktree: the main checkout keeps npm run dev. In Claude Code, /worktree <name> creates one with its environment.",
    )
  }
  const slug = basename(paths.root)
  const problem = slugProblem(slug)
  if (problem)
    throw new Error(`The worktree folder "${slug}" cannot name an environment: ${problem}.`)
  return { ...paths, ...environmentOfSlug(slug, paths.mainCheckout) }
}

function environmentOfSlug(slug, mainCheckout = repositoryPaths().mainCheckout) {
  const mainApiEnv = readEnvFile(join(mainCheckout, "apps/api/.env"))
  const routerPort = Number(readMainStackEnv(mainCheckout).ROUTER_PORT || 8800)
  return {
    slug,
    mainCheckout,
    mainApiEnv,
    routerPort,
    names: environmentNames(slug, routerPort),
    stateDir: join(STATE_DIR, "envs", slug),
  }
}

function readMainStackEnv(mainCheckout = repositoryPaths().mainCheckout) {
  return readEnvFile(join(mainCheckout, "infra/database/.env"))
}

function readEnvFile(path) {
  return existsSync(path) ? readEnvValues(readFileSync(path, "utf8")) : {}
}

/** Starts what is missing of the shared stack, never recreating it. Returns the Postgres. */
function ensureSharedStack(mainCheckout) {
  const missing = SHARED_SERVICES.filter(([name]) => !sharedContainer(name))
  if (missing.length > 0) {
    console.log(`Starting the shared stack: ${missing.map(([name]) => name).join(", ")}`)
    mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
    const profiles = [...new Set(missing.map(([, profile]) => profile).filter(Boolean))]
    const code = runVisible(
      "docker",
      sharedCompose(mainCheckout, [
        ...profiles.flatMap((profile) => ["--profile", profile]),
        "up",
        "-d",
        "--no-recreate",
        ...missing.map(([name]) => name),
      ]),
    )
    if (code !== 0) {
      throw new Error(
        "Could not start the shared stack. If the main checkout has no router profile yet, update it (git pull), then run npm run wt -- setup.",
      )
    }
  }
  const postgres = sharedContainer("pgvector")
  if (!postgres) throw new Error("The shared Postgres does not run: npm run wt -- setup")
  return postgres
}

function dexPasswordHash() {
  if (!existsSync(PASSWORD_HASH_FILE)) {
    throw new Error(
      "No local dev password yet: run `node infra/dex/sync-users.mjs` from the main checkout first.",
    )
  }
  return readFileSync(PASSWORD_HASH_FILE, "utf8").trim()
}

function checkNodeModulesVolumes(environment) {
  const lock = JSON.parse(readFileSync(join(environment.root, "package-lock.json"), "utf8"))
  const missing = missingNodeModulesVolumes(nodeModulesFolders(lock))
  if (missing.length > 0) {
    throw new Error(
      `${COMPOSE_FILE} has no node_modules volume for ${missing.join(", ")}: add one to x-node-volumes, to the init service and to infra/worktree/init.sh.`,
    )
  }
}

function refuseForeignProject(environment) {
  const foreign = listContainers([
    `label=com.docker.compose.project=${environment.names.project}`,
  ]).find((container) => container.Labels["dev.worktree.path"] !== environment.root)
  if (foreign) {
    throw new Error(
      `${environment.names.project} belongs to ${foreign.Labels["dev.worktree.path"]}: remove it there (npm run wt -- down), or rename this worktree.`,
    )
  }
}

async function chooseRedisPort(environment, previous) {
  const used = new Set(
    listContainers(["label=dev.worktree.service=bullmq"])
      .filter((container) => container.Labels["dev.worktree.slug"] !== environment.slug)
      .flatMap((container) =>
        [...(container.Ports ?? "").matchAll(/:(\d+)->6379/gu)].map((match) => Number(match[1])),
      ),
  )
  const own = Number(previous.WT_REDIS_PORT)
  if (own && !used.has(own)) return own
  for (let port = 16380; port < 16480; port += 1) {
    if (!used.has(port) && (await isPortFree(port))) return port
  }
  throw new Error("No free port for the environment's Redis between 16380 and 16479.")
}

function gcpCredentials(environment) {
  const configured = environment.mainApiEnv.GOOGLE_APPLICATION_CREDENTIALS
  const hostPath = configured ? resolve(environment.mainCheckout, "apps/api", configured) : null
  if (hostPath && existsSync(hostPath)) return { hostPath, inContainer: "/run/secrets/gcp.json" }
  console.warn(
    "No Google Cloud credentials in the main checkout's apps/api/.env: file storage, PDF pages and Vertex AI will fail.",
  )
  const placeholder = join(STATE_DIR, "no-gcp-credentials.json")
  if (!existsSync(placeholder)) writeFileAtomic(placeholder, "{}\n")
  return { hostPath: placeholder, inContainer: "" }
}

/**
 * The configuration of the environment's Dex: the people of its database (of the main
 * checkout's before the copy exists) and this environment's redirect URIs only.
 */
function writeDexConfig(environment, postgres, passwordHash) {
  const database = databaseNames(postgres).includes(environment.names.database)
    ? environment.names.database
    : environment.mainApiEnv.DATABASE_NAME || "connect"
  const users = readHumanUsers({ container: postgres, database })
  const webEnv = {
    ...readEnvFile(join(environment.root, "apps/web/.env")),
    ...readEnvFile(join(environment.root, "apps/web/.env.local")),
  }
  const uris = redirectUris({
    webOrigins: [environment.names.origin],
    basePath: webEnv.VITE_BASE_PATH,
    bullBoardBaseUrl: environment.names.origin,
  })
  const config = buildDexConfig({
    issuer: environment.names.dexIssuer,
    listenAddress: `0.0.0.0:${environment.routerPort}`,
    webRedirectUris: uris.web,
    bullBoardRedirectUris: uris.bullBoard,
    users,
    passwordHash,
  })
  // Read by the Dex container, which runs as another user.
  mkdirSync(environment.stateDir, { recursive: true, mode: 0o755 })
  writeFileAtomic(join(environment.stateDir, "dex.yaml"), config, 0o644)
  return users.length
}

/** Docker would create the missing mount points as root, which blocks a host `npm ci`. */
function prepareMountPoints(environment) {
  for (const folder of TEMPLATE_NODE_MODULES_FOLDERS) {
    mkdirSync(join(environment.root, folder, "node_modules"), { recursive: true })
  }
  mkdirSync(join(environment.root, "apps/api/.certs"), { recursive: true })
}

/** The env files of the main checkout that the worktree lacks (created without Claude Code). */
function copyMissingEnvFiles(environment) {
  for (const path of findEnvFiles(environment.mainCheckout)) {
    const target = join(environment.root, path)
    if (!existsSync(target) && existsSync(dirname(target))) {
      copyFileSync(join(environment.mainCheckout, path), target)
      console.log(`Copied ${path} from the main checkout.`)
    }
  }
}

function findEnvFiles(root, folder = "", depth = 0) {
  const skipped = new Set(["node_modules", ".git", ".claude", "dist", "dontsave", ".turbo"])
  const found = []
  for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name
    if (entry.isDirectory() && depth < 3 && !skipped.has(entry.name)) {
      found.push(...findEnvFiles(root, path, depth + 1))
    } else if (entry.isFile() && (entry.name === ".env" || entry.name === ".env.test")) {
      found.push(path)
    }
  }
  return found
}

/** Host commands in the worktree (tests, migrations, scripts) use the environment's data. */
function pointHostEnvFilesAtEnvironment(environment, { redisPort, gcp }) {
  const apiEnvFile = join(environment.root, "apps/api/.env")
  const apiTestFile = join(environment.root, "apps/api/.env.test")
  const values = hostEnvValues({
    names: environment.names,
    redisPort,
    gcpCredentials: gcp,
    testDatabaseUrl: readEnvFile(apiTestFile).DATABASE_URL,
  })
  editEnvFile(apiEnvFile, values.api, ["DATABASE_URL"])
  if (Object.keys(values.apiTest).length > 0) editEnvFile(apiTestFile, values.apiTest)
}

function editEnvFile(path, values, onlyExisting = []) {
  if (!existsSync(path)) return
  const before = readFileSync(path, "utf8")
  const after = setEnvValues(before, values, {
    comment: "Worktree environment (npm run wt -- up)",
    onlyExisting,
  })
  if (after !== before) writeFileAtomic(path, after, statSync(path).mode & 0o777)
}

/** `npm ci` on the host when package-lock.json changed, for the commands Claude runs there. */
function installHostDependencies(environment, lockHash) {
  const stamp = join(environment.root, "node_modules/.package-lock-hash")
  if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === lockHash) return
  console.log("Installing the host dependencies of the worktree (npm ci)...")
  if (runVisible("npm", ["ci", "--no-audit", "--no-fund"], { cwd: environment.root }) !== 0) {
    throw new Error("npm ci failed in the worktree, see above.")
  }
  writeFileAtomic(stamp, `${lockHash}\n`)
}

function compose(environment, args) {
  return runVisible("docker", ["compose", "-f", join(environment.root, COMPOSE_FILE), ...args], {
    cwd: environment.root,
  })
}

function composeServices(environment) {
  return run("docker", [
    "compose",
    "-p",
    environment.names.project,
    "ps",
    "--all",
    "--format",
    "json",
  ])
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line)
      return Array.isArray(parsed) ? parsed : [parsed]
    })
}

async function waitUntilReady(environment) {
  const deadline = Date.now() + 20 * 60 * 1000
  const reported = new Set()
  for (;;) {
    const services = composeServices(environment)
    for (const entry of services.filter((candidate) => ONE_SHOT_SERVICES.has(candidate.Service))) {
      if (entry.State === "exited" && entry.ExitCode !== 0) {
        printLogs(environment, entry.Service)
        throw new Error(
          `The ${entry.Service} step failed (exit ${entry.ExitCode}), see its logs above.`,
        )
      }
    }
    const ready = services.filter((entry) =>
      ONE_SHOT_SERVICES.has(entry.Service)
        ? entry.State === "exited" && entry.ExitCode === 0
        : entry.State === "running" && (entry.Health === "healthy" || entry.Health === ""),
    )
    for (const entry of ready) {
      if (!reported.has(entry.Service)) {
        reported.add(entry.Service)
        console.log(`  ✓ ${entry.Service}`)
      }
    }
    const unhealthy = services.find((entry) => entry.Health === "unhealthy")
    if (unhealthy) {
      printLogs(environment, unhealthy.Service)
      throw new Error(`${unhealthy.Service} is unhealthy, see its logs above.`)
    }
    if (services.length > 0 && ready.length === services.length) return
    if (Date.now() > deadline) {
      const waiting = services
        .filter((entry) => !ready.includes(entry))
        .map((entry) => entry.Service)
      throw new Error(
        `Still starting after 20 minutes: ${waiting.join(", ")}. See npm run wt -- logs <service>.`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
}

/** Traefik serves 404 for about 2 s after a container starts, until its route loads. */
async function waitForRoutes(environment) {
  const host = `${environment.slug}.connect.localhost:${environment.routerPort}`
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = await throughRouter(environment.routerPort, host, "/")
    if (code !== 0 && code !== 404) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  console.warn(`The router does not serve ${host} yet: check npm run wt -- doctor.`)
}

function printLogs(environment, serviceName) {
  runVisible("docker", [
    "compose",
    "-p",
    environment.names.project,
    "logs",
    "--tail",
    "40",
    serviceName,
  ])
}

function recordStatus(environment) {
  const branch = currentBranch(environment.root)
  updateStatus(environment.slug, {
    path: environment.root,
    branch,
    pr: pullRequestOf(branch, environment.root),
    databases: { app: environment.names.database, test: environment.names.testDatabase },
    upAt: new Date().toISOString(),
  })
}

function printSummary(environment, startedAt) {
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  const width = Math.max(...environment.names.links.map(([label]) => label.length)) + 2
  console.log(
    `\nEnvironment ${environment.slug} is ready (${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s)`,
  )
  for (const [label, url] of environment.names.links) console.log(`  ${label.padEnd(width)}${url}`)
  console.log(`  ${"All".padEnd(width)}http://dev.connect.localhost:${environment.routerPort}`)
  console.log(`
Databases: ${environment.names.database} (copy of ${environment.mainApiEnv.DATABASE_NAME || "connect"}), ${environment.names.testDatabase}.
Sign in with your email and the local dev password. Commands you run here (tests, migrations)
use these databases. Logs: npm run wt -- logs <service>.`)
}

// --- Databases --------------------------------------------------------------------------------

function dumpDatabase(postgres, database, slug) {
  const folder = join(STATE_DIR, "trash")
  mkdirSync(folder, { recursive: true, mode: 0o700 })
  const path = join(folder, `${slug}-${new Date().toISOString().replaceAll(":", "-")}.dump`)
  const output = openSync(path, "w", 0o600)
  try {
    const result = spawnSync(
      "docker",
      ["exec", postgres, "pg_dump", "-U", "admin", "-Fc", "-d", database],
      {
        stdio: ["ignore", output, "inherit"],
      },
    )
    if (result.status !== 0) throw new Error(`pg_dump of ${database} failed: nothing was removed.`)
  } finally {
    closeSync(output)
  }
  return path
}

function dropDatabases(postgres, slug) {
  if (!postgres) return
  for (const database of databaseNames(postgres).filter((name) => isDatabaseOf(slug, name))) {
    psql(postgres, "postgres", `DROP DATABASE "${database}" WITH (FORCE);`)
    console.log(`Dropped ${database}.`)
  }
}

function pruneTrash() {
  const folder = join(STATE_DIR, "trash")
  if (!existsSync(folder)) return
  const limit = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).mtimeMs < limit) rmSync(path, { force: true })
  }
}

/** The read-only role of the Grafana datasources (Makefile analytics-dev-role). */
function ensureGrafanaRole(postgres) {
  const hasReader = psql(
    postgres,
    "postgres",
    "SELECT 1 FROM pg_roles WHERE rolname = 'analytics_reader';",
  )
  if (hasReader !== "1") {
    console.warn(
      "No analytics_reader role yet (run the migrations of main): Grafana will show no data.",
    )
    return
  }
  psql(
    postgres,
    "postgres",
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grafana_ro') THEN CREATE ROLE grafana_ro LOGIN PASSWORD 'passpass'; END IF; END $$;
GRANT analytics_reader TO grafana_ro;
ALTER ROLE grafana_ro SET statement_timeout = '30s';`,
  )
}

function service(container) {
  return container.Labels["dev.worktree.service"] ?? container.Labels["com.docker.compose.service"]
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}
