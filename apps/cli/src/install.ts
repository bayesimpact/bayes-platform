import { randomBytes, timingSafeEqual } from "node:crypto"
import { createServer, type Server } from "node:http"
import { appManifestSlugSchema, parseLoopbackRedirectUri } from "@caseai-connect/api-contracts"

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

export type AppsInstallIO = {
  slug: string
  frontendOrigin: string
  openUrl: (url: string) => void
  write: (text: string) => void
  writeError: (text: string) => void
  state?: string
  timeoutMs?: number
  color?: boolean
}

export function parseFrontendOrigin(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Frontend origin must be an http(s) URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Frontend origin must be an http(s) URL")
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Frontend origin must not include credentials, a query, or a hash")
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("Frontend origin must not include a path")
  }
  return url.origin
}

export async function runAppsInstall(io: AppsInstallIO): Promise<number> {
  const slug = appManifestSlugSchema.safeParse(io.slug)
  if (!slug.success) {
    io.writeError("Slug must be lowercase kebab-case.\n")
    return 1
  }

  let frontendOrigin: string
  try {
    frontendOrigin = parseFrontendOrigin(io.frontendOrigin)
  } catch (error) {
    io.writeError(`${error instanceof Error ? error.message : "Invalid frontend origin"}\n`)
    return 1
  }

  const state = io.state ?? randomBytes(32).toString("base64url")
  const outcome = await waitForCallback({
    state,
    timeoutMs: io.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    slug: slug.data,
    onListening: (redirectUri) => {
      parseLoopbackRedirectUri(redirectUri)
      const installUrl = new URL(`/apps/install/${slug.data}`, frontendOrigin)
      installUrl.searchParams.set("redirect_uri", redirectUri)
      installUrl.searchParams.set("state", state)
      io.write(
        `${emphasis(`Approve ${slug.data} in your browser.`, io.color)}\nThis command waits here until you do.\n\n${muted(installUrl.toString(), io.color)}\n`,
      )
      io.openUrl(installUrl.toString())
    },
  })

  if (outcome.kind === "authorized") {
    io.write(
      `\n${emphasis(`${slug.data} is installed.`, io.color)}\n\n${emphasis("Client id", io.color)}\n${outcome.clientId}\n\n${emphasis("Client secret", io.color)}\n${outcome.clientSecret}\n\nSave the client secret now. It cannot be retrieved later.\n`,
    )
    return 0
  }

  if (outcome.kind === "denied") {
    io.writeError("Authorization was cancelled.\n")
    return 1
  }
  if (outcome.kind === "mismatch") {
    io.writeError("The callback state did not match this session. Nothing was saved.\n")
    return 1
  }
  if (outcome.kind === "timeout") {
    io.writeError("Authorization timed out.\n")
    return 1
  }
  io.writeError("The callback did not include a client id and client secret.\n")
  return 1
}

function emphasis(text: string, color: boolean | undefined): string {
  if (!color) return text
  return `\u001b[1m${text}\u001b[0m`
}

function muted(text: string, color: boolean | undefined): string {
  if (!color) return text
  return `\u001b[2m${text}\u001b[0m`
}

function renderCallbackPage(slug: string, outcome: CallbackOutcome["kind"]): string {
  const copy =
    outcome === "authorized"
      ? {
          title: `${slug} is installed`,
          detail:
            "The client id and client secret are in your terminal. Save the secret now. It cannot be retrieved later.",
        }
      : outcome === "denied"
        ? {
            title: "Authorization cancelled",
            detail: "Nothing was saved. You can close this tab.",
          }
        : {
            title: "Authorization failed",
            detail: "Return to your terminal for what went wrong.",
          }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f4f4f6; color: #111118; font: 16px/1.5 Inter, system-ui, sans-serif; }
  .card { width: 100%; max-width: 440px; box-sizing: border-box; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
  .mark { width: 40px; height: 40px; display: grid; grid-template-columns: 1fr 1fr; border-radius: 10px; overflow: hidden; border: 1px solid #e4e4e7; margin-bottom: 16px; }
  .mark span:nth-child(1) { background: #1e1154; }
  .mark span:nth-child(2) { background: #7c3aed; }
  .mark span:nth-child(3) { background: #a855f7; }
  .mark span:nth-child(4) { background: #c084fc; }
  h1 { font-size: 18px; line-height: 1.35; margin: 0 0 8px; }
  p { margin: 0; color: #71717a; font-size: 14px; }
</style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <h1>${escapeHtml(copy.title)}</h1>
    <p>${escapeHtml(copy.detail)}</p>
  </main>
  <script>history.replaceState(null, "", "/callback")</script>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

type CallbackOutcome =
  | { kind: "authorized"; clientId: string; clientSecret: string }
  | { kind: "denied" }
  | { kind: "mismatch" }
  | { kind: "invalid" }
  | { kind: "timeout" }

async function waitForCallback(params: {
  slug: string
  state: string
  timeoutMs: number
  onListening: (redirectUri: string) => void
}): Promise<CallbackOutcome> {
  let finish: (outcome: CallbackOutcome) => void = () => {}
  const done = new Promise<CallbackOutcome>((resolve) => {
    finish = resolve
  })
  let settled = false
  const settle = (outcome: CallbackOutcome) => {
    if (settled) return
    settled = true
    finish(outcome)
  }

  const handler = (
    request: import("node:http").IncomingMessage,
    response: import("node:http").ServerResponse,
  ) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1")
    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204)
      response.end()
      return
    }
    if (request.method !== "GET" || requestUrl.pathname !== "/callback") {
      response.writeHead(404)
      response.end("Not found")
      return
    }

    const outcome = readCallback(requestUrl, params.state)
    const status = outcome.kind === "mismatch" || outcome.kind === "invalid" ? 400 : 200
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" })
    response.end(renderCallbackPage(params.slug, outcome.kind), () => settle(outcome))
  }

  const servers = await listenOnLoopback(handler)
  const port = readPort(servers[0])
  const timeout = setTimeout(() => settle({ kind: "timeout" }), params.timeoutMs)

  try {
    params.onListening(`http://localhost:${port}/callback`)
    return await done
  } finally {
    clearTimeout(timeout)
    await Promise.all(servers.map((server) => closeServer(server)))
  }
}

function readCallback(requestUrl: URL, expectedState: string): CallbackOutcome {
  const receivedState = requestUrl.searchParams.get("state") ?? ""
  if (!statesMatch(expectedState, receivedState)) return { kind: "mismatch" }
  if (requestUrl.searchParams.get("error") === "access_denied") return { kind: "denied" }
  const clientId = requestUrl.searchParams.get("client_id")
  const clientSecret = requestUrl.searchParams.get("client_secret")
  if (!clientId || !clientSecret) return { kind: "invalid" }
  return { kind: "authorized", clientId, clientSecret }
}

function statesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

async function listenOnLoopback(
  handler: (
    request: import("node:http").IncomingMessage,
    response: import("node:http").ServerResponse,
  ) => void,
): Promise<Server[]> {
  const ipv4 = createServer(handler)
  await listen(ipv4, "127.0.0.1")
  const servers = [ipv4]
  const ipv6 = createServer(handler)
  try {
    await listen(ipv6, "::1", readPort(ipv4))
    servers.push(ipv6)
  } catch {
    ipv6.close()
  }
  return servers
}

function listen(server: Server, host: string, port = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once("error", onError)
    server.listen(port, host, () => {
      server.off("error", onError)
      resolve()
    })
  })
}

function readPort(server: Server | undefined): number {
  const address = server?.address()
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind the loopback callback")
  }
  return address.port
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}
