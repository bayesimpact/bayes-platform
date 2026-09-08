import type { McpServerOauthTokens } from "../mcp-server-config.types"

/**
 * An access token with no known expiry (the token response omitted
 * `expires_in`, which RFC 6749 allows) is never considered expired.
 * `marginMs` lets callers treat a token as expired slightly early so a refresh
 * happens before the server rejects it.
 */
export function isAccessTokenExpired(
  tokens: McpServerOauthTokens,
  now = Date.now(),
  marginMs = 0,
): boolean {
  return tokens.expiresAt !== undefined && tokens.expiresAt - marginMs <= now
}

/**
 * Whether the stored tokens can still yield a valid access token: either the
 * access token is still usable, or it can be refreshed. Tokens that fail this
 * are dead weight and the server needs a new browser authorization.
 */
export function canStillAuthenticate(
  tokens: McpServerOauthTokens | undefined,
  now = Date.now(),
): boolean {
  if (!tokens) return false
  if (tokens.refreshToken) return true
  return !isAccessTokenExpired(tokens, now)
}
