const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export class InvalidLoopbackRedirectUriError extends Error {
  constructor(message = "redirectUri must be a loopback http(s) URL (localhost or 127.0.0.1)") {
    super(message)
    this.name = "InvalidLoopbackRedirectUriError"
  }
}

export class InvalidInstallRedirectUriError extends Error {
  constructor(
    message = "redirectUri must be a registered callback URL for this app, or a loopback http(s) URL (localhost or 127.0.0.1)",
  ) {
    super(message)
    this.name = "InvalidInstallRedirectUriError"
  }
}

/** RFC 8252 native-app loopback: http(s) on localhost / 127.0.0.1 / ::1 only. */
export function parseLoopbackRedirectUri(raw: string): URL {
  const url = parseHttpRedirectUri(raw)
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
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
 * Accept install redirect_uri when it is a loopback URL (local CLI / native apps)
 * or an exact string match against the app's registered allowlist.
 */
export function isAllowedInstallRedirectUri(raw: string, allowlist: readonly string[]): boolean {
  if (isLoopbackRedirectUri(raw)) return true
  if (!isHttpRedirectUri(raw)) return false
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
