// Side effects of the worktree tooling: git, docker, the shared Postgres, files and locks.
// Node built-ins only.
import { execFileSync, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { request } from "node:http"
import { createServer } from "node:net"
import { uptime } from "node:os"
import { dirname, join } from "node:path"
import { STATE_DIR } from "../../dex/dex-config.mjs"

/** Runs a command and returns its trimmed stdout. Throws with its stderr on failure. */
export function run(command, args, { cwd, input, env } = {}) {
  try {
    return execFileSync(command, args, {
      cwd,
      input,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: "utf8",
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim()
  } catch (error) {
    const details = String(error.stderr ?? "").trim() || error.message
    throw new Error(`${command} ${args.join(" ")} failed: ${details}`)
  }
}

/** Runs a command with its output on the terminal. Returns its exit code. */
export function runVisible(command, args, { cwd, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: "inherit",
  })
  return result.status ?? 1
}

/** The checkout the command runs in, and the main checkout of the repository. */
export function repositoryPaths(cwd = process.cwd()) {
  const [root, gitDir, commonDir] = run(
    "git",
    ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"],
    { cwd },
  ).split("\n")
  return { root, isMain: gitDir === commonDir, mainCheckout: dirname(commonDir) }
}

/** What the containers of a clone are labeled with: its main checkout, links resolved. */
export function repositoryId(mainCheckout) {
  return realpathSync(mainCheckout)
}

/** The shared stack's compose command, always on the main checkout's file and folder. */
export function sharedCompose(mainCheckout, args) {
  const folder = join(mainCheckout, "infra/database")
  return [
    "compose",
    "--project-directory",
    folder,
    "-f",
    join(folder, "docker-compose.yaml"),
    ...args,
  ]
}

/** Containers of the Docker daemon with their labels, as `docker ps --all` JSON lines. */
export function listContainers(filters = []) {
  const args = ["ps", "--all", "--no-trunc", "--format", "{{json .}}"]
  for (const filter of filters) args.push("--filter", filter)
  return run("docker", args)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const container = JSON.parse(line)
      const labels = Object.fromEntries(
        (container.Labels ?? "")
          .split(",")
          .filter(Boolean)
          .map((pair) => {
            const index = pair.indexOf("=")
            return [pair.slice(0, index), pair.slice(index + 1)]
          }),
      )
      return { ...container, Labels: labels }
    })
}

/** The running container of a service of the shared stack, or null. */
export function sharedContainer(service) {
  return (
    listContainers([
      "label=com.docker.compose.project=connect-db",
      `label=com.docker.compose.service=${service}`,
      "status=running",
    ])[0]?.Names ?? null
  )
}

/** Runs SQL as the admin superuser in the shared Postgres, through its container. */
export function psql(container, database, sql) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "admin",
      "-d",
      database,
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql },
  )
}

export function databaseNames(container) {
  return psql(container, "postgres", "SELECT datname FROM pg_database ORDER BY 1;")
    .split("\n")
    .filter(Boolean)
}

/** Whether nothing listens on a loopback port. */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
  })
}

/**
 * A GET (or another method) through the router with an explicit Host header: Node on
 * macOS 15 and older cannot resolve *.localhost, and fetch cannot set Host.
 */
export function throughRouter(routerPort, host, path, method = "GET") {
  return new Promise((resolve) => {
    const call = request(
      { host: "127.0.0.1", port: routerPort, path, method, headers: { host }, timeout: 5000 },
      (reply) => {
        reply.resume()
        reply.on("end", () => resolve(reply.statusCode ?? 0))
      },
    )
    call.on("timeout", () => call.destroy())
    call.on("error", () => resolve(0))
    call.end()
  })
}

/** Writes a file atomically, so readers never see half of it. */
export function writeFileAtomic(path, content, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, content, { mode })
  renameSync(temporary, path)
}

export function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

/**
 * Holds a lock while `work` runs: per environment, so two sessions never set up or remove the
 * same environment at once, or for the whole machine around a choice that environments share.
 * Names of machine-wide locks start with "_", which no environment name can.
 */
export async function withLock(name, work) {
  const release = acquireLock(name, {
    waitMs: 15 * 60 * 1000,
    pollMs: 500,
    onWait: (pid) => console.log(`Waiting for process ${pid}, which is working on ${name}...`),
  })
  try {
    return await work()
  } finally {
    release()
  }
}

/**
 * Runs `work` under the lock when nobody holds it, and returns `{ result }`. When a live process
 * holds it, returns `{ busy: pid }` at once.
 */
export async function withLockIfFree(name, work) {
  let release
  try {
    release = acquireLock(name, { waitMs: 0, pollMs: 0 })
  } catch (error) {
    if (error.code === "ELOCKED") return { busy: error.pid }
    throw error
  }
  try {
    return { result: await work() }
  } finally {
    release()
  }
}

/** The same lock around short synchronous work, such as a read-modify-write of a shared file. */
export function withLockSync(name, work) {
  const release = acquireLock(name, { waitMs: 30 * 1000, pollMs: 10 })
  try {
    return work()
  } finally {
    release()
  }
}

/**
 * Takes the lock file, waiting while a live process holds it, and returns its release. The file
 * holds the holder's pid and start time, which also serve as its token: a release removes the
 * file only while it still holds that token.
 */
function acquireLock(name, { waitMs, pollMs, onWait = () => {} }) {
  const path = join(STATE_DIR, "locks", `${name}.lock`)
  mkdirSync(dirname(path), { recursive: true })
  const deadline = Date.now() + waitMs
  let announced = false
  for (;;) {
    const token = JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      bootId: BOOT_ID,
      uptime: uptime(),
    })
    try {
      writeFileSync(path, token, { flag: "wx" })
      return () => {
        if (readText(path) === token) rmSync(path, { force: true })
      }
    } catch (error) {
      if (error.code !== "EEXIST") throw error
    }
    const text = readText(path)
    if (text === null) continue
    const holder = parseJson(text)
    if (isAbandoned(name, path, holder)) {
      // A dead holder never rewrites its file: if it changed, someone else took it over.
      if (readText(path) === text) rmSync(path, { force: true })
      continue
    }
    if (Date.now() >= deadline) {
      throw Object.assign(
        new Error(`${name} is locked by process ${holder?.pid ?? "unknown"} (${path})`),
        { code: "ELOCKED", pid: holder?.pid },
      )
    }
    if (holder && !announced) {
      onWait(holder.pid)
      announced = true
    }
    sleep(pollMs)
  }
}

/**
 * Identifies the current boot of the machine, or null where unknown. Unlike the wall clock, it
 * does not move when the time is set.
 */
export const BOOT_ID = readBootId()
// Machine-wide locks guard a few seconds of work at most.
const MACHINE_LOCK_MAX_AGE_SECONDS = 60

function readBootId() {
  try {
    if (process.platform === "linux") {
      return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()
    }
    if (process.platform === "darwin") {
      return execFileSync("sysctl", ["-n", "kern.bootsessionuuid"], { encoding: "utf8" }).trim()
    }
  } catch {
    // Unknown: locks then rely on the holder's pid only.
  }
  return null
}

function isAbandoned(name, path, holder) {
  // The holder writes its token right after creating the file. An empty file is a lock being
  // taken, unless it stays empty: then its process died in between.
  if (!holder) return ageInMs(path) > 10_000
  if (BOOT_ID && holder.bootId) {
    // Taken during an earlier boot: its pid may now belong to another process.
    if (holder.bootId !== BOOT_ID) return true
    // Uptime, unlike the wall clock, only moves forward during a boot.
    const age = uptime() - holder.uptime
    if (name.startsWith("_") && age > MACHINE_LOCK_MAX_AGE_SECONDS) return true
  }
  return !isAlive(holder.pid)
}

/** A file's text, or null when it does not exist. */
function readText(path) {
  try {
    return readFileSync(path, "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** The age of a file, or 0 when it is gone (its holder just released it). */
function ageInMs(path) {
  try {
    return Date.now() - statSync(path).mtimeMs
  } catch {
    return 0
  }
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === "EPERM"
  }
}

export function fileExists(path) {
  return existsSync(path)
}

/** Whether nothing is at `path`. A path that cannot be read, another user's for example, is not gone. */
export function isGone(path) {
  try {
    statSync(path)
    return false
  } catch (error) {
    return error.code === "ENOENT"
  }
}
