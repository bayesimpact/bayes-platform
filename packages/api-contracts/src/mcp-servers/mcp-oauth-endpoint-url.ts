/**
 * Allowlist for OAuth endpoint URLs discovered from third-party MCP servers.
 *
 * The API validates every discovered endpoint before storing it and the web
 * app re-checks the authorization URL right before `window.location.assign`,
 * where a `javascript:` or `data:` URL would run on the app origin. Both sides
 * share this one rule so they cannot drift: `https:` is accepted, `http:` only
 * for localhost so local dev authorization servers keep working.
 */
export function isAllowedOauthEndpointUrl(candidate: string): boolean {
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return false
  }
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
}
