/**
 * Redaction of what the API writes to its logs and traces. No imports on purpose:
 * `open-telemetry-init.ts` loads this file before NestJS and the instrumented modules.
 */

/**
 * Fields that carry credentials (OAuth codes, verifiers and tokens, client
 * secrets) or a visitor's message (`q`, the payload of the public chat v1 GET
 * stream). Their values never reach the logs, even at debug level.
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

export function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      REDACTED_FIELDS.has(key) ? "[redacted]" : redactCredentials(fieldValue),
    ]),
  )
}

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
