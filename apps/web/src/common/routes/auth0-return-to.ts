/**
 * Where to send the user back after an Auth0 login redirect.
 *
 * `ProtectedRoute` stores the current in-app location in Auth0's `appState`
 * before redirecting to login. Auth0 always returns to the origin, so this
 * value is what lets the app resume on the page the user was on (for
 * example the MCP OAuth callback, whose single-use code and state live in
 * the query string).
 */
export function buildReturnTo(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`
}

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 0x20 || codePoint === 0x7f
  })

/**
 * Accepts only same-origin relative paths. `appState` round-trips through
 * Auth0 and browser storage, so anything that could turn into an external
 * redirect (protocol-relative `//host`, backslash tricks, absolute URLs) is
 * rejected and the caller falls back to the default behavior.
 */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//") || value.startsWith("/\\")) return null
  if (hasControlCharacter(value)) return null
  return value
}
