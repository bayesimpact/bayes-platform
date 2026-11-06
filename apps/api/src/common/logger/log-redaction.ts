/**
 * Redaction of the request URL that the exception filter writes to the logs.
 */

/**
 * Query parameters that carry credentials (OAuth codes, verifiers and tokens,
 * client secrets) or a visitor's message (`q`, the payload of the public chat
 * v1 GET stream). Their values never reach the logs.
 */
const REDACTED_FIELDS = new Set([
  "access_token",
  "client_secret",
  "code",
  "code_verifier",
  "password",
  "q",
  "refresh_token",
  "token",
])

/** `url` with the value of every redacted field of its query string replaced. */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf("?")
  if (queryStart === -1) return url
  const query = url
    .slice(queryStart + 1)
    .split("&")
    .map((pair) => {
      const rawKey = pair.split("=")[0] ?? ""
      return REDACTED_FIELDS.has(decodeQueryKey(rawKey)) ? `${rawKey}=[redacted]` : pair
    })
    .join("&")
  return `${url.slice(0, queryStart)}?${query}`
}

function decodeQueryKey(rawKey: string): string {
  try {
    return decodeURIComponent(rawKey.replaceAll("+", " "))
  } catch {
    return rawKey
  }
}
