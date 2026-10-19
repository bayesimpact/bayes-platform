import type { Request } from "express"
import { OAuthProtocolError } from "./oauth-protocol.error"

/** What a client sent to authenticate at the token and revocation endpoints. */
export type OAuthClientCredentials = { clientId: string; clientSecret: string } | null

/**
 * `client_secret_basic` (RFC 6749 section 2.3.1): the client id and secret,
 * each form-urlencoded, joined by a colon and base64-encoded. Null when the
 * request does not use it; a malformed header is an invalid client.
 */
export function readClientSecretBasic(request: Request): OAuthClientCredentials {
  const header = request.headers.authorization
  if (!header || !/^Basic\s/i.test(header)) return null
  const encoded = /^Basic\s+(\S+)$/i.exec(header)?.[1]
  if (!encoded) throw new OAuthProtocolError("invalid_client")
  const decoded = Buffer.from(encoded, "base64").toString("utf8")
  const separator = decoded.indexOf(":")
  if (separator <= 0) throw new OAuthProtocolError("invalid_client")
  try {
    const clientId = decodeURIComponent(decoded.slice(0, separator).replaceAll("+", " "))
    const clientSecret = decodeURIComponent(decoded.slice(separator + 1).replaceAll("+", " "))
    if (!clientSecret) throw new OAuthProtocolError("invalid_client")
    return { clientId, clientSecret }
  } catch {
    throw new OAuthProtocolError("invalid_client")
  }
}

/** The client a token request counts against, whichever way it authenticates. */
export function readClientIdForRateLimit(request: Request): string {
  const bodyClientId = (request.body as { client_id?: unknown } | undefined)?.client_id
  if (typeof bodyClientId === "string") return bodyClientId
  try {
    return readClientSecretBasic(request)?.clientId ?? "none"
  } catch {
    return "none"
  }
}
