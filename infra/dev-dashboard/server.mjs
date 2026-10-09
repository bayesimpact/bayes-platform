// Dashboard of the worktree environments, served by the router profile of infra/database at
// http://dev.connect.localhost:<router port>. Read-only: it lists containers through the Docker
// socket (GET requests only) and reads the status file of the worktree tooling. Traefik also
// sends it the requests for hosts that no running service answers, so it shows what is starting
// or what to start. Node built-ins only.
import { readFileSync } from "node:fs"
import { createServer, request } from "node:http"
import { join } from "node:path"
import { buildState, DASHBOARD_HOST, describeHost, hostname } from "./model.mjs"

const PORT = Number(process.env.PORT ?? 8080)
const ROUTER_PORT = Number(process.env.ROUTER_PORT ?? 8800)
const STATE_DIR = process.env.STATE_DIR ?? "/state"
const PAGE = readFileSync(new URL("./index.html", import.meta.url), "utf8")

createServer((incoming, response) => {
  handle(incoming, response).catch((error) => {
    console.error(error)
    send(response, 500, "text/plain; charset=utf-8", "Dashboard error, see its container logs.")
  })
}).listen(PORT, () => console.log(`Dashboard listening on ${PORT}`))

async function handle(incoming, response) {
  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    send(response, 405, "text/plain; charset=utf-8", "Read-only")
    return
  }
  const host = hostname(incoming.headers.host)
  const path = new URL(incoming.url ?? "/", "http://localhost").pathname
  if (path === "/healthz") {
    send(response, 200, "text/plain; charset=utf-8", "ok")
    return
  }
  if (host === DASHBOARD_HOST && path === "/api/state") {
    send(response, 200, "application/json", JSON.stringify(await currentState()))
    return
  }
  if (host === DASHBOARD_HOST && path === "/") {
    send(response, 200, "text/html; charset=utf-8", PAGE)
    return
  }
  // Any other host: Traefik's catch-all or its errors middleware. Explain what is going on.
  send(response, 503, "text/html; charset=utf-8", statusPage(await currentState(), host))
}

async function currentState() {
  return buildState({
    containers: await dockerGet("/containers/json?all=1"),
    status: readStatusFile(),
    routerPort: ROUTER_PORT,
    now: new Date().toISOString(),
  })
}

function dockerGet(path) {
  return new Promise((resolve, reject) => {
    const call = request({ socketPath: "/var/run/docker.sock", path, method: "GET" }, (reply) => {
      let body = ""
      reply.setEncoding("utf8")
      reply.on("data", (chunk) => {
        body += chunk
      })
      reply.on("end", () => {
        if (reply.statusCode !== 200) reject(new Error(`Docker API ${path}: ${reply.statusCode}`))
        else resolve(JSON.parse(body))
      })
    })
    call.on("error", reject)
    call.end()
  })
}

function readStatusFile() {
  try {
    return JSON.parse(readFileSync(join(STATE_DIR, "status.json"), "utf8"))
  } catch {
    return {}
  }
}

function statusPage(state, host) {
  const { environment, link, service, guess, shared } = describeHost(state, host)
  const dashboard = state.dashboardUrl
  let title
  let details
  if (environment) {
    const ready = environment.services.filter((service) =>
      ["healthy", "running", "done"].includes(service.health),
    ).length
    title = `${environment.slug}: ${link.name} is not answering yet`
    details = `<p>${ready} of ${environment.services.length} services are ready. This page reloads by itself.</p>
<ul>${environment.services
      .map((service) => `<li>${escapeHtml(service.name)}: ${escapeHtml(service.health)}</li>`)
      .join("")}</ul>
<p>Logs: <code>npm run wt -- logs ${escapeHtml(service)}</code> in the worktree.</p>`
  } else if (shared) {
    title = `${shared.name} is not routed`
    details = `<p>It is stopped, or it was started before its route existed. Start or recreate it from the main checkout, in <code>infra/database</code>: <code>${escapeHtml(shared.command)}</code>.</p>`
  } else {
    title = `No environment answers at ${host}`
    details = `<p>Start it from Claude Code with <code>/worktree ${escapeHtml(guess)}</code>.</p>`
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${environment ? '<meta http-equiv="refresh" content="3">' : ""}
<title>${escapeHtml(title)}</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #1f2933; background: #fff; }
code { background: #eef1f4; padding: 0.1rem 0.3rem; border-radius: 4px; }
a { color: #2f6fde; }
@media (prefers-color-scheme: dark) { body { color: #e4e7eb; background: #12161b; } code { background: #232a32; } a { color: #6ea8fe; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${details}
<p><a href="${escapeHtml(dashboard)}">All environments</a></p>
</body>
</html>`
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  )
}

function send(response, status, contentType, body) {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" })
  response.end(body)
}
