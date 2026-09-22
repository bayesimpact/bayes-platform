const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export class InvalidLoopbackRedirectUriError extends Error {
  constructor(message = "redirectUri must be a loopback http(s) URL (localhost or 127.0.0.1)") {
    super(message)
    this.name = "InvalidLoopbackRedirectUriError"
  }
}

/** RFC 8252 native-app loopback: http(s) on localhost / 127.0.0.1 / ::1 only. */
export function parseLoopbackRedirectUri(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new InvalidLoopbackRedirectUriError()
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidLoopbackRedirectUriError()
  }

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

export function buildAppInstallCallbackUrl(params: {
  redirectUri: string
  clientId: string
  clientSecret: string
  state: string
}): string {
  const url = parseLoopbackRedirectUri(params.redirectUri)
  url.searchParams.set("client_id", params.clientId)
  url.searchParams.set("client_secret", params.clientSecret)
  url.searchParams.set("state", params.state)
  return url.toString()
}
