import type {
  CorsOptions,
  CorsOptionsDelegate,
} from "@nestjs/common/interfaces/external/cors-options.interface"

/**
 * OAuth and MCP protocol endpoints (token, registration, revocation, the MCP
 * endpoint, the well-known metadata) serve MCP clients, some of which run in
 * a browser on any origin. They are secured by PKCE, client ids and Bearer
 * tokens, never cookies, so the origin is reflected (ADR 0028).
 *
 * Kept apart from `cors.ts`, whose `/public/*` branch belongs to the public
 * API contract: this wrapper decides these paths and hands every other
 * request to that policy unchanged.
 */
const OPEN_PROTOCOL_PATHS = [
  "/api/oauth/token",
  "/api/oauth/register",
  "/api/oauth/revoke",
  "/api/mcp",
]

export function isOpenProtocolPath(url: string): boolean {
  const path = url.split("?")[0] ?? ""
  return path.startsWith("/.well-known/") || OPEN_PROTOCOL_PATHS.includes(path)
}

export function withOpenProtocolCors(
  delegate: CorsOptionsDelegate<{ url?: string }>,
): CorsOptionsDelegate<{ url?: string }> {
  return (req, callback: (error: Error | null, options: CorsOptions) => void) => {
    if (req.url && isOpenProtocolPath(req.url)) {
      callback(null, { origin: true })
      return
    }
    delegate(req, callback)
  }
}
