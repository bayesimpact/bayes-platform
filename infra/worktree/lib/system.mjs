// Side effects of the worktree tooling: git, docker, the shared Postgres, files and locks.
// Node built-ins only.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { request } from "node:http"
import { createServer } from "node:net"
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
 * Holds a per-environment lock while `work` runs, so two sessions never set up or remove the
 * same environment at once. A lock whose process is gone is taken over.
 */
export async function withLock(name, work) {
  const path = join(STATE_DIR, "locks", `${name}.lock`)
  mkdirSync(dirname(path), { recursive: true })
  const deadline = Date.now() + 15 * 60 * 1000
  let announced = false
  for (;;) {
    try {
      writeFileSync(
        path,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
        {
          flag: "wx",
        },
      )
      break
    } catch (error) {
      if (error.code !== "EEXIST") throw error
      const holder = readJson(path, {})
      if (!isAlive(holder.pid)) {
        rmSync(path, { force: true })
        continue
      }
      if (Date.now() > deadline) throw new Error(`${name} is locked by process ${holder.pid}`)
      if (!announced) {
        console.log(`Waiting for process ${holder.pid}, which is working on ${name}...`)
        announced = true
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  try {
    return await work()
  } finally {
    rmSync(path, { force: true })
  }
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
