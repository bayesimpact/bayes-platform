const LOOPBACK_IP_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"])

export class InvalidLoopbackRedirectUriError extends Error {
  constructor(
    message = "redirectUri must be a loopback http(s) URL (localhost, *.localhost, 127.0.0.1, or ::1)",
  ) {
    super(message)
    this.name = "InvalidLoopbackRedirectUriError"
  }
}

export class InvalidInstallRedirectUriError extends Error {
  constructor(
    message = "redirectUri must be a registered https callback URL for this app, or a loopback http(s) URL (localhost, *.localhost, 127.0.0.1, or ::1)",
  ) {
    super(message)
    this.name = "InvalidInstallRedirectUriError"
  }
}

/**
 * RFC 8252 loopback IPs, plus RFC 6761 `.localhost` (including bare `localhost`
 * and names like `acme.localhost`).
 */
export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (LOOPBACK_IP_HOSTS.has(normalized)) return true
  return normalized === "localhost" || normalized.endsWith(".localhost")
}

/** RFC 8252 / RFC 6761 native-app loopback: http(s) on a loopback host only. */
export function parseLoopbackRedirectUri(raw: string): URL {
  const url = parseHttpRedirectUri(raw)
  if (!isLoopbackHostname(url.hostname)) {
    throw new InvalidLoopbackRedirectUriError()
  }
  return url
}

export function isLoopbackRedirectUri(raw: string): boolean {
  try {
    parseLoopbackRedirectUri(raw)
    return true
  } catch {
    return false
  }
}

/** Any http(s) redirect URI (loopback or registered callback). */
export function parseHttpRedirectUri(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new InvalidInstallRedirectUriError()
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidInstallRedirectUriError()
  }

  return url
}

export function isHttpRedirectUri(raw: string): boolean {
  try {
    parseHttpRedirectUri(raw)
    return true
  } catch {
    return false
  }
}

/**
 * Accept install redirect_uri when it is a loopback URL (local CLI / *.localhost)
 * or an exact https match against the app's registered allowlist.
 */
export function isAllowedInstallRedirectUri(raw: string, allowlist: readonly string[]): boolean {
  if (isLoopbackRedirectUri(raw)) return true
  if (!isHttpRedirectUri(raw)) return false
  const url = parseHttpRedirectUri(raw)
  if (url.protocol !== "https:") return false
  return allowlist.includes(raw)
}

export function assertAllowedInstallRedirectUri(raw: string, allowlist: readonly string[]): string {
  if (!isAllowedInstallRedirectUri(raw, allowlist)) {
    throw new InvalidInstallRedirectUriError()
  }
  return raw
}

/** Redirect after approve: one-time `code` + `state` only (never the client secret). */
export function buildAppInstallCallbackUrl(params: {
  redirectUri: string
  code: string
  state: string
}): string {
  const url = parseHttpRedirectUri(params.redirectUri)
  url.searchParams.set("code", params.code)
  url.searchParams.set("state", params.state)
  return url.toString()
}

export function buildAppInstallDeniedUrl(params: { redirectUri: string; state: string }): string {
  const url = parseHttpRedirectUri(params.redirectUri)
  url.searchParams.set("error", "access_denied")
  url.searchParams.set("state", params.state)
  return url.toString()
}
