/**
 * OAuth discovery for MCP servers, per the MCP Authorization spec:
 * RFC 9728 (protected resource metadata), RFC 8414 (authorization server
 * metadata) and RFC 7591 (dynamic client registration). Pure functions over
 * global fetch so they can be unit-tested without Nest.
 *
 * Every URL fetched here is attacker-influenced (the MCP URL comes from a
 * project member, the rest from that server's responses), so each one passes
 * through the outbound URL guard before any request is made.
 */

import { assertAllowedOutboundUrl, isAllowedOutboundUrl } from "./outbound-url-guard"

export type McpOauthDiscovery = {
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint?: string
  /** Canonical resource URI (RFC 8707), from the protected resource metadata. */
  resource: string
  scopesSupported?: string[]
}

// Outbound OAuth discovery calls hit third-party servers named in MCP server
// config; a slow or hanging server must not block the request indefinitely.
const OAUTH_FETCH_TIMEOUT_MS = 10_000

/**
 * A discovered endpoint is later handed to the browser (authorization_endpoint
 * becomes a `window.location.assign` target) or fetched server-side (token and
 * registration endpoints). A hostile authorization server could return a
 * `javascript:` or `data:` URL, or point at an internal host, so every
 * endpoint from third-party JSON goes through the outbound URL guard. `http:`
 * is allowed only for localhost behind MCP_OAUTH_ALLOW_INSECURE_LOCAL.
 */
function isValidEndpointUrl(candidate: string): Promise<boolean> {
  return isAllowedOutboundUrl(candidate)
}

type ProtectedResourceMetadata = {
  resource?: string
  authorization_servers?: string[]
  scopes_supported?: string[]
}

type AuthorizationServerMetadata = {
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
}

/**
 * Returns null when the server advertises no usable OAuth metadata. Throws
 * DisallowedOutboundUrlError when the MCP URL itself is not a public https
 * URL; callers surface that to the user since it is their input.
 */
export async function discoverOauthConfiguration(
  mcpUrl: string,
): Promise<McpOauthDiscovery | null> {
  await assertAllowedOutboundUrl(mcpUrl)
  const resourceMetadataUrl = await probeForResourceMetadataUrl(mcpUrl)
  if (!(await isAllowedOutboundUrl(resourceMetadataUrl))) return null
  const resourceMetadata = await fetchJson<ProtectedResourceMetadata>(resourceMetadataUrl)
  if (!resourceMetadata?.authorization_servers?.length) return null

  const issuer = (resourceMetadata.authorization_servers as string[])[0]!.replace(/\/$/, "")
  if (!(await isAllowedOutboundUrl(issuer))) return null
  const serverMetadata =
    (await fetchJson<AuthorizationServerMetadata>(
      `${issuer}/.well-known/oauth-authorization-server`,
    )) ??
    (await fetchJson<AuthorizationServerMetadata>(`${issuer}/.well-known/openid-configuration`))
  if (!serverMetadata?.authorization_endpoint || !serverMetadata.token_endpoint) return null
  if (
    !(await isValidEndpointUrl(serverMetadata.authorization_endpoint)) ||
    !(await isValidEndpointUrl(serverMetadata.token_endpoint))
  ) {
    return null
  }
  const registrationEndpoint =
    serverMetadata.registration_endpoint &&
    (await isValidEndpointUrl(serverMetadata.registration_endpoint))
      ? serverMetadata.registration_endpoint
      : undefined

  return {
    authorizationEndpoint: serverMetadata.authorization_endpoint,
    tokenEndpoint: serverMetadata.token_endpoint,
    registrationEndpoint,
    resource: resourceMetadata.resource ?? mcpUrl,
    scopesSupported: resourceMetadata.scopes_supported,
  }
}

export async function registerOauthClient({
  registrationEndpoint,
  redirectUri,
}: {
  registrationEndpoint: string
  redirectUri: string
}): Promise<string> {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Bayes Platform",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(OAUTH_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Dynamic client registration failed with status ${response.status}`)
  }
  const body = (await response.json()) as { client_id?: string }
  if (!body.client_id) throw new Error("Dynamic client registration returned no client_id")
  return body.client_id
}

/**
 * Probes the MCP endpoint expecting a 401 whose WWW-Authenticate names the
 * resource metadata URL. Falls back to the RFC 9728 path-derived well-known
 * URL when the header is absent, points off-origin (a malicious or misbehaving
 * server naming an attacker-controlled metadata host), or the probe itself
 * fails.
 */
async function probeForResourceMetadataUrl(mcpUrl: string): Promise<string> {
  const mcpOrigin = new URL(mcpUrl).origin
  try {
    const probe = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }),
      redirect: "manual",
      signal: AbortSignal.timeout(OAUTH_FETCH_TIMEOUT_MS),
    })
    const wwwAuthenticate = probe.headers.get("www-authenticate")
    if (wwwAuthenticate) {
      const match = wwwAuthenticate.match(/resource_metadata="([^"]+)"/)
      if (match?.[1]) {
        try {
          if (new URL(match[1]).origin === mcpOrigin) return match[1]
        } catch {
          // Falls through to the well-known fallback below.
        }
      }
    }
  } catch {
    // Network errors fall through to the well-known fallback.
  }
  const url = new URL(mcpUrl)
  const path: string = url.pathname === "/" ? "" : (url.pathname ?? "")
  return `${url.origin}/.well-known/oauth-protected-resource${path}`
}

async function fetchJson<ResponseBody>(url: string): Promise<ResponseBody | null> {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(OAUTH_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return null
    return (await response.json()) as ResponseBody
  } catch {
    return null
  }
}
