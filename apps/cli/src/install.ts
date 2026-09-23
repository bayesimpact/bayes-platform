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
    onListening: (redirectUri) => {
      parseLoopbackRedirectUri(redirectUri)
      const installUrl = new URL(`/apps/install/${slug.data}`, frontendOrigin)
      installUrl.searchParams.set("redirect_uri", redirectUri)
      installUrl.searchParams.set("state", state)
      io.write(`Opening ${installUrl.toString()}\n`)
      io.openUrl(installUrl.toString())
    },
  })

  if (outcome.kind === "authorized") {
    io.write(`client_id: ${outcome.clientId}\n`)
    io.write(`client_secret: ${outcome.clientSecret}\n`)
    io.write("\nSave the client secret now. It cannot be retrieved later.\n")
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

type CallbackOutcome =
  | { kind: "authorized"; clientId: string; clientSecret: string }
  | { kind: "denied" }
  | { kind: "mismatch" }
  | { kind: "invalid" }
  | { kind: "timeout" }

async function waitForCallback(params: {
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
    const body =
      outcome.kind === "authorized"
        ? "Authorization complete. Return to your terminal."
        : outcome.kind === "denied"
          ? "Authorization cancelled. Return to your terminal."
          : "Authorization failed. Return to your terminal."
    const status = outcome.kind === "mismatch" || outcome.kind === "invalid" ? 400 : 200
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" })
    response.end(`<!doctype html><title>Bayes</title><p>${body}</p>`, () => settle(outcome))
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
