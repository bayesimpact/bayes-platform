const LOOPBACK_IP_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"])

export class InvalidLoopbackRedirectUriError extends Error {
  constructor(
    message = "redirectUri must be a loopback http(s) URL (localhost, *.localhost, 127.0.0.1, or ::1)",
  ) {
    super(message)
    this.name = "InvalidLoopbackRedirectUriError"
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
    throw new Error("redirect URI must be an http(s) URL")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("redirect URI must be an http(s) URL")
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
 * The redirect URIs of an app (ADR 0029): a loopback URL for local development,
 * or an exact https match against the redirect URIs of its manifest.
 */
export function isAllowedInstallRedirectUri(raw: string, allowlist: readonly string[]): boolean {
  if (isLoopbackRedirectUri(raw)) return true
  if (!isHttpRedirectUri(raw)) return false
  const url = parseHttpRedirectUri(raw)
  if (url.protocol !== "https:") return false
  return allowlist.includes(raw)
}
