// What the daemon of `wt serve` decides, without side effects: its token, its routes and the
// command behind each action. See docs/adr/0026-worktree-control-daemon.md.
import { createHash, timingSafeEqual } from "node:crypto"
import { join } from "node:path"
import { slugProblem } from "./naming.mjs"
import { validRestorePointId } from "./promote.mjs"

// Machine-wide: each daemon describes itself here, and the dashboard's container mounts it.
export const DAEMON_DIR = process.env.WT_DAEMON_DIR ?? "/var/tmp/bayes-worktrees"
export const TOKEN_HEADER = "x-wt-token"

const TOKEN_PATTERN = /^(\d+)\.([A-Za-z0-9_-]{32,})$/u
const SERVICE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u

// Actions on one environment: the quick ones run docker compose and answer at once, the others
// become jobs whose output the page streams.
const COMPOSE_ACTIONS = new Set(["start", "stop", "restart"])
const JOB_ACTIONS = new Set(["up", "down", "reset-db", "cleanup"])
const OTHER_ACTIONS = new Set(["logs", "open", "describe"])
const MAX_DESCRIPTION = 500
const MAX_SELECTED_ROWS = 20000

/** The uid and secret of a token, `<uid>.<secret>`, or null. */
export function parseToken(token) {
  const match = typeof token === "string" ? token.match(TOKEN_PATTERN) : null
  return match ? { uid: Number(match[1]), secret: match[2] } : null
}

/** Compares two tokens in constant time. */
export function sameToken(given, expected) {
  const hash = (value) => createHash("sha256").update(String(value)).digest()
  return typeof given === "string" && timingSafeEqual(hash(given), hash(expected))
}

/** The route of a request, or null when the daemon has none. */
export function matchRoute(method, pathname) {
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] !== "api") return null
  const [, resource, id, action, extra] = parts
  if (method === "GET" && parts.length === 2 && ["me", "status", "jobs"].includes(resource)) {
    return { route: resource }
  }
  if (resource === "jobs" && parts.length === 3 && method === "GET") {
    return /^[a-f0-9-]{36}$/u.test(id) ? { route: "job", id } : null
  }
  if (resource === "worktrees" && parts.length === 2 && method === "POST") {
    return { route: "new" }
  }
  // Restore points of the main database, which `promote` takes.
  if (resource === "restore-points") {
    if (method === "GET" && parts.length === 2) return { route: "restore-points" }
    if (method === "POST" && action === "restore" && extra === undefined) {
      return validRestorePointId(id) ? { route: "restore", id } : null
    }
    return null
  }
  if (resource !== "environments" || extra !== undefined || slugProblem(id ?? "")) return null
  if (action === "logs" && method === "GET") return { route: "logs", slug: id }
  // The diff of its data with the main database (GET), or copying a selection of it (POST).
  if (action === "promote" && ["GET", "POST"].includes(method)) {
    return { route: method === "GET" ? "promote-diff" : "promote", slug: id }
  }
  if (method !== "POST") return null
  if (COMPOSE_ACTIONS.has(action)) return { route: "compose", slug: id, action }
  if (JOB_ACTIONS.has(action)) return { route: "job-action", slug: id, action }
  if (OTHER_ACTIONS.has(action)) return { route: action, slug: id }
  return null
}

/** A service name given by the page, or null when it is missing or not one. */
export function validService(service) {
  return typeof service === "string" && SERVICE_PATTERN.test(service) ? service : null
}

/**
 * The `wt.mjs` run behind a job: the worktree's own copy for what touches its environment, as in
 * a terminal there, and the main checkout's for the rest or once the worktree is gone.
 */
export function jobCommand({
  action,
  slug,
  name,
  description,
  path,
  worktreeExists,
  mainCheckout,
  selection,
  restorePoint,
}) {
  const main = { script: join(mainCheckout, "infra/worktree/wt.mjs"), cwd: mainCheckout }
  const own = worktreeExists ? { script: join(path, "infra/worktree/wt.mjs"), cwd: path } : null
  switch (action) {
    case "new":
      return {
        ...main,
        args: ["new", name, ...(description ? ["--description", description] : [])],
      }
    case "cleanup":
      return { ...main, args: ["cleanup", "--apply", "--slug", slug] }
    case "promote-diff":
      return { ...main, args: ["promote", "--slug", slug, "--json"] }
    case "promote":
      return { ...main, args: ["promote", "--slug", slug, "--apply", "--selection", selection] }
    case "restore":
      return { ...main, args: ["restore-main", restorePoint] }
    case "down":
      return own ? { ...own, args: ["down"] } : { ...main, args: ["down", "--slug", slug] }
    case "up":
    case "reset-db":
      if (!own) throw new Error(`The worktree of ${slug} is gone: only down or cleanup work.`)
      return { ...own, args: [action] }
    default:
      throw new Error(`Unknown action ${action}`)
  }
}

/** The rows a page selected for `promote`: row keys, or null when it is not a list of them. */
export function validSelection(keys) {
  if (!Array.isArray(keys) || !keys.length || keys.length > MAX_SELECTED_ROWS) return null
  return keys.every(
    (key) => typeof key === "string" && key.length <= 512 && /^[a-z0-9_]+:\[/u.test(key),
  )
    ? keys
    : null
}

/** A description given by the page, trimmed, or null when it is missing or too long. */
export function validDescription(description) {
  if (typeof description !== "string") return null
  const text = description.trim()
  return text && text.length <= MAX_DESCRIPTION ? text : null
}

/** How a daemon tells the dashboard where it listens: a socket on Linux, a port on a Mac. */
export function daemonDescription({ uid, user, platform, port }) {
  return platform === "darwin" ? { uid, user, port } : { uid, user, socket: `${uid}.sock` }
}

/** The link that gives the dashboard the token, in a fragment, which no request carries. */
export function loginUrl(dashboardUrl, token) {
  return `${dashboardUrl}/#token=${encodeURIComponent(token)}`
}
