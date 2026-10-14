// The daemon of `wt serve`: it runs the wt commands of its user's environments for the buttons
// of the dashboard and of the menu bar app, which reach it through the dashboard's gateway.
// See docs/adr/0026-worktree-control-daemon.md. Node built-ins only.
import { execFile, spawn } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { uptime, userInfo } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { STATE_DIR } from "../../dex/dex-config.mjs"
import {
  DAEMON_DIR,
  daemonDescription,
  jobCommand,
  matchRoute,
  parseToken,
  sameToken,
  TOKEN_HEADER,
  validDescription,
  validService,
} from "./daemon.mjs"
import { slugProblem } from "./naming.mjs"
import { readStatus } from "./status.mjs"
import { readJson, writeFileAtomic } from "./system.mjs"

export const TOKEN_FILE = join(STATE_DIR, "api-token")
export const DAEMON_FILE = join(STATE_DIR, "daemon.json")
const MAX_BODY = 16 * 1024
const MAX_JOB_OUTPUT = 2 * 1024 * 1024
const KEPT_JOBS = 20
// Hosts a request may name: the dashboard through its gateway, or a local client.
const ALLOWED_HOSTS = new Set([
  "dev.connect.localhost",
  "localhost",
  "127.0.0.1",
  "host.docker.internal",
])

const execFileAsync = promisify(execFile)
const uid = process.getuid()
const descriptionFile = join(DAEMON_DIR, `${uid}.json`)

/** The user's token, created on first use, replaced with `rotate`. */
export function ensureToken({ rotate = false } = {}) {
  if (!rotate && existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, "utf8").trim()
  const token = `${uid}.${randomBytes(32).toString("base64url")}`
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  writeFileAtomic(TOKEN_FILE, `${token}\n`, 0o600)
  return token
}

/** Whether this user's daemon runs: its description names a live process. */
export function daemonRunning() {
  const description = readJson(descriptionFile, null)
  if (!description?.pid) return false
  // After a reboot, another process may have taken the recorded pid.
  if (Math.abs((description.bootedAt ?? 0) - bootedAt()) > 60_000) return false
  try {
    process.kill(description.pid, 0)
    return true
  } catch {
    return false
  }
}

/** When the machine started, give or take a second: what tells a pid of an earlier boot. */
function bootedAt() {
  return Date.now() - uptime() * 1000
}

export async function serve({ mainCheckout }) {
  if (daemonRunning()) {
    console.log(`The daemon of ${userInfo().username} already runs (${descriptionFile}).`)
    return
  }
  ensureToken()
  mkdirSync(DAEMON_DIR, { recursive: true })
  // Every user of the machine adds their daemon here; the sticky bit keeps each one's files.
  try {
    chmodSync(DAEMON_DIR, 0o1777)
  } catch {}

  const jobs = new Map()
  const server = createServer((request, response) => {
    handle({ request, response, jobs, mainCheckout }).catch((error) => {
      if (!response.headersSent) sendJson(response, 500, { error: error.message })
      else response.end()
    })
  })

  const socket = join(DAEMON_DIR, `${uid}.sock`)
  const platform = process.platform
  if (platform === "darwin") {
    // Docker Desktop cannot pass a host socket to a container: a loopback port, which the
    // dashboard reaches as host.docker.internal.
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  } else {
    rmSync(socket, { force: true })
    await new Promise((resolve) => server.listen(socket, resolve))
    chmodSync(socket, 0o600)
  }
  const description = {
    ...daemonDescription({
      uid,
      user: userInfo().username,
      platform,
      port: server.address()?.port,
    }),
    pid: process.pid,
    bootedAt: bootedAt(),
    mainCheckout,
  }
  writeFileAtomic(descriptionFile, `${JSON.stringify(description, null, 2)}\n`)
  // How to start it again, for the menu bar app of a Mac, whose PATH knows neither node nor npm.
  writeFileAtomic(
    DAEMON_FILE,
    `${JSON.stringify({ mainCheckout, node: process.execPath }, null, 2)}\n`,
  )
  console.log(
    `wt serve: ${description.user}'s daemon listens (${description.socket ?? `port ${description.port}`}).`,
  )

  const stop = () => {
    if (readJson(descriptionFile, null)?.pid === process.pid)
      rmSync(descriptionFile, { force: true })
    if (platform !== "darwin") rmSync(socket, { force: true })
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}

async function handle({ request, response, jobs, mainCheckout }) {
  const url = new URL(request.url ?? "/", "http://localhost")
  const host = (request.headers.host ?? "").replace(/:\d+$/u, "").toLowerCase()
  if (!ALLOWED_HOSTS.has(host)) return sendJson(response, 421, { error: "Unknown host" })
  const origin = request.headers.origin
  if (origin && new URL(origin).hostname !== "dev.connect.localhost") {
    return sendJson(response, 403, { error: "Unknown origin" })
  }
  const route = matchRoute(request.method, url.pathname)
  if (!route) return sendJson(response, 404, { error: "Unknown route" })
  // The status feeds the dashboard of everyone: branch and pull request, nothing to act on.
  if (route.route === "status") {
    return sendJson(response, 200, {
      uid,
      user: userInfo().username,
      environments: readStatus().environments ?? {},
    })
  }
  const given = request.headers[TOKEN_HEADER]
  // Read at each request, so that `wt login --rotate` takes effect at once.
  if (parseToken(given)?.uid !== uid || !sameToken(given, ensureToken())) {
    return sendJson(response, 401, { error: "Missing or wrong token: npm run wt -- login" })
  }

  switch (route.route) {
    case "me":
      return sendJson(response, 200, {
        uid,
        user: userInfo().username,
        platform: process.platform,
        mainCheckout,
      })
    case "jobs":
      return sendJson(response, 200, { jobs: [...jobs.values()].map(jobSummary) })
    case "job": {
      const job = jobs.get(route.id)
      if (!job) return sendJson(response, 404, { error: "No such job" })
      return streamJob(job, request, response)
    }
    case "new": {
      const { name, description } = await readBody(request)
      const problem = typeof name === "string" ? slugProblem(name) : "give a name"
      if (problem) return sendJson(response, 400, { error: `${name}: ${problem}` })
      if (description !== undefined && !validDescription(description)) {
        return sendJson(response, 400, { error: "A description of at most 500 characters" })
      }
      return startJob({
        jobs,
        response,
        slug: name,
        action: "new",
        command: jobCommand({
          action: "new",
          name,
          description: validDescription(description),
          mainCheckout,
        }),
      })
    }
  }

  const environment = await ownEnvironment(route.slug)
  if (!environment) {
    return sendJson(response, 403, { error: `${route.slug} is not one of your environments` })
  }
  const project = `wt-${route.slug}`
  switch (route.route) {
    case "compose": {
      const { service } = await readBody(request)
      if (service !== undefined && !validService(service)) {
        return sendJson(response, 400, { error: "Invalid service" })
      }
      try {
        await execFileAsync("docker", [
          "compose",
          "-p",
          project,
          route.action,
          ...(service ? [service] : []),
        ])
        return sendJson(response, 200, { ok: true })
      } catch (error) {
        return sendJson(response, 500, { error: String(error.stderr || error.message).trim() })
      }
    }
    case "job-action": {
      await readBody(request)
      const command = jobCommand({
        action: route.action,
        slug: route.slug,
        mainCheckout,
        ...environment,
      })
      return startJob({ jobs, response, slug: route.slug, action: route.action, command })
    }
    case "logs": {
      const service = url.searchParams.get("service")
      if (service && !validService(service))
        return sendJson(response, 400, { error: "Invalid service" })
      const args = ["compose", "-p", project, "logs", "--no-color", "--tail", "300"]
      if (url.searchParams.get("follow") === "1") args.push("--follow")
      if (service) args.push(service)
      return streamProcess(
        spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] }),
        request,
        response,
      )
    }
    case "describe": {
      // `wt describe` in the worktree: it also reads the pull request again, a few seconds.
      const description = validDescription((await readBody(request)).description)
      if (!description) {
        return sendJson(response, 400, { error: "A description of at most 500 characters" })
      }
      if (!environment.worktreeExists) {
        return sendJson(response, 410, { error: "The worktree is gone" })
      }
      try {
        await execFileAsync(
          process.execPath,
          [join(environment.path, "infra/worktree/wt.mjs"), "describe", description],
          { cwd: environment.path },
        )
        return sendJson(response, 200, { ok: true })
      } catch (error) {
        return sendJson(response, 500, { error: String(error.stderr || error.message).trim() })
      }
    }
    case "open": {
      const { target } = await readBody(request)
      if (!environment.worktreeExists)
        return sendJson(response, 410, { error: "The worktree is gone" })
      return sendJson(response, ...openFolder(environment.path, target))
    }
  }
  return sendJson(response, 404, { error: "Unknown route" })
}

/**
 * The environment of `slug` when it belongs to this user: its worktree folder is theirs, or,
 * once that folder is gone, its state folder is in their home. Null otherwise.
 */
async function ownEnvironment(slug) {
  const { stdout } = await execFileAsync("docker", [
    "ps",
    "--all",
    "--no-trunc",
    "--filter",
    `label=dev.worktree.slug=${slug}`,
    "--format",
    '{{.Label "dev.worktree.path"}}',
  ])
  const path = stdout.split("\n").find(Boolean)
  if (path && existsSync(path)) {
    return statSync(path).uid === uid ? { path, worktreeExists: true } : null
  }
  return existsSync(join(STATE_DIR, "envs", slug)) ? { path, worktreeExists: false } : null
}

function startJob({ jobs, response, slug, action, command }) {
  const running = [...jobs.values()].find((job) => job.slug === slug && job.exitCode === null)
  if (running) {
    return sendJson(response, 409, {
      error: `${running.action} of ${slug} still runs`,
      job: jobSummary(running),
    })
  }
  const job = {
    id: randomUUID(),
    slug,
    action,
    command: `npm run wt -- ${command.args.join(" ")}`,
    startedAt: new Date().toISOString(),
    output: [],
    size: 0,
    exitCode: null,
    listeners: new Set(),
  }
  const child = spawn(process.execPath, [command.script, ...command.args], {
    cwd: command.cwd,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const add = (chunk) => {
    const text = chunk.toString()
    if (job.size < MAX_JOB_OUTPUT) {
      job.output.push(text)
      job.size += text.length
    }
    for (const listener of job.listeners) listener({ type: "output", text })
  }
  child.stdout.on("data", add)
  child.stderr.on("data", add)
  child.on("error", (error) => add(`${error.message}\n`))
  child.on("close", (code) => {
    job.exitCode = code ?? 1
    for (const listener of job.listeners) listener({ type: "exit", code: job.exitCode })
    job.listeners.clear()
  })
  jobs.set(job.id, job)
  for (const old of [...jobs.values()].slice(0, Math.max(0, jobs.size - KEPT_JOBS))) {
    if (old.exitCode !== null) jobs.delete(old.id)
  }
  return sendJson(response, 202, { job: jobSummary(job) })
}

function jobSummary(job) {
  const { id, slug, action, command, startedAt, exitCode } = job
  return { id, slug, action, command, startedAt, exitCode }
}

/** The output of a job as JSON lines: what it printed so far, then what comes until it ends. */
function streamJob(job, request, response) {
  startStream(response)
  const write = (event) => response.write(`${JSON.stringify(event)}\n`)
  for (const text of job.output) write({ type: "output", text })
  if (job.exitCode !== null) {
    write({ type: "exit", code: job.exitCode })
    return response.end()
  }
  const listener = (event) => {
    write(event)
    if (event.type === "exit") response.end()
  }
  job.listeners.add(listener)
  request.on("close", () => job.listeners.delete(listener))
}

function streamProcess(child, request, response) {
  startStream(response)
  const write = (chunk) =>
    response.write(`${JSON.stringify({ type: "output", text: chunk.toString() })}\n`)
  child.stdout.on("data", write)
  child.stderr.on("data", write)
  child.on("close", (code) => {
    response.write(`${JSON.stringify({ type: "exit", code: code ?? 0 })}\n`)
    response.end()
  })
  request.on("close", () => child.kill())
}

function startStream(response) {
  response.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  })
}

/** Opens the worktree in the editor or a terminal of a Mac; elsewhere there is no screen. */
function openFolder(path, target) {
  if (process.platform !== "darwin") {
    return [501, { error: `Nothing to open on this machine: the worktree is at ${path}` }]
  }
  const commands = {
    terminal: ["open", ["-a", "Terminal", path]],
    folder: ["open", [path]],
    // WT_EDITOR names the editor's command (webstorm, code, cursor...), VS Code by default.
    editor: [process.env.WT_EDITOR || "code", [path]],
  }
  const command = commands[target]
  if (!command) return [400, { error: "Open what: editor, terminal or folder" }]
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" })
  child.on("error", () => {})
  child.unref()
  return [200, { ok: true }]
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      body += chunk
      if (body.length > MAX_BODY) {
        reject(new Error("Body too large"))
        request.destroy()
      }
    })
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error("The body is not JSON"))
      }
    })
    request.on("error", reject)
  })
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
  response.end(JSON.stringify(body))
}
