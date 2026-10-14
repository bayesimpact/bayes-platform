// The gateway of the dashboard's buttons: it forwards a request to the daemon (`wt serve`) of the
// user its token names, after checking where it comes from. See
// docs/adr/0026-worktree-control-daemon.md. Node built-ins only.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { request } from "node:http"
import { join } from "node:path"

export const TOKEN_HEADER = "x-wt-token"
const TOKEN_PATTERN = /^(\d+)\.[A-Za-z0-9_-]{32,}$/u

/**
 * Whether the gateway forwards a request: never a CORS preflight, which the token header forces
 * on every other origin, only the dashboard's origin for a browser, and a token shaped
 * `<uid>.<secret>`. The daemon checks the secret.
 */
export function gatewayDecision({ method, origin, token, dashboardOrigin }) {
  if (method === "OPTIONS") return { status: 403, error: "No cross-origin calls" }
  if (origin && origin !== dashboardOrigin) return { status: 403, error: "Unknown origin" }
  const match = typeof token === "string" ? token.match(TOKEN_PATTERN) : null
  if (!match) return { status: 401, error: "No token: run npm run wt -- login and open its link" }
  return { uid: Number(match[1]) }
}

/**
 * Where the daemon of `uid` listens, from its description. Its files must belong to that uid, or
 * to root as every host file does under Docker Desktop, so nobody stands in for a colleague.
 */
export function daemonTarget(directory, uid, owner = (path) => statSync(path).uid) {
  const file = join(directory, `${uid}.json`)
  let description
  try {
    if (![uid, 0].includes(owner(file))) return null
    description = JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return null
  }
  if (description.uid !== uid) return null
  if (description.socket) {
    const socketPath = join(directory, `${uid}.sock`)
    try {
      return [uid, 0].includes(owner(socketPath)) ? { socketPath } : null
    } catch {
      return null
    }
  }
  if (Number.isInteger(description.port))
    return { host: "host.docker.internal", port: description.port }
  return null
}

/** Forwards a request to a daemon and streams its answer back. */
export function forward(incoming, response, target) {
  const headers = {
    host: incoming.headers.host,
    [TOKEN_HEADER]: incoming.headers[TOKEN_HEADER],
    ...(incoming.headers.origin ? { origin: incoming.headers.origin } : {}),
    ...(incoming.headers["content-type"]
      ? { "content-type": incoming.headers["content-type"] }
      : {}),
  }
  const upstream = request(
    { ...target, method: incoming.method, path: incoming.url, headers },
    (reply) => {
      response.writeHead(reply.statusCode ?? 502, {
        "content-type": reply.headers["content-type"] ?? "application/json",
        "cache-control": "no-store",
      })
      reply.pipe(response)
    },
  )
  upstream.on("error", () => {
    if (response.headersSent) return response.end()
    response.writeHead(502, { "content-type": "application/json" })
    response.end(JSON.stringify({ error: "Your daemon does not answer: npm run wt -- serve" }))
  })
  // A log followed until the page closes it.
  response.on("close", () => upstream.destroy())
  incoming.pipe(upstream)
}

/**
 * The branch, pull request and cleanup verdict of every user's environments, from their daemons,
 * with the owner of each.
 */
export async function daemonStatuses(directory) {
  let files
  try {
    files = readdirSync(directory).filter((name) => /^\d+\.json$/u.test(name))
  } catch {
    return {}
  }
  const answers = await Promise.all(
    files.map((name) => {
      const target = daemonTarget(directory, Number(name.slice(0, -5)))
      return target ? getJson(target, "/api/status").catch(() => null) : null
    }),
  )
  const environments = {}
  for (const answer of answers) {
    for (const [slug, details] of Object.entries(answer?.environments ?? {})) {
      environments[slug] = { ...details, owner: answer.user, ownerUid: answer.uid }
    }
  }
  return environments
}

function getJson(target, path) {
  return new Promise((resolve, reject) => {
    const call = request(
      { ...target, path, method: "GET", headers: { host: "dev.connect.localhost" }, timeout: 1000 },
      (reply) => {
        let body = ""
        reply.setEncoding("utf8")
        reply.on("data", (chunk) => {
          body += chunk
        })
        reply.on("end", () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      },
    )
    call.on("timeout", () => call.destroy(new Error("timeout")))
    call.on("error", reject)
    call.end()
  })
}
