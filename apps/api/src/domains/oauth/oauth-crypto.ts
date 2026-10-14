import { createHash, createSign, createVerify, randomBytes, timingSafeEqual } from "node:crypto"
import { normalizePem } from "@/domains/apps/app-jwt"

export type OAuthAccessTokenClaims = {
  iss: string
  aud: string
  sub: string
  client_id: string
  grant_id: string
  scope: string
  iat: number
  exp: number
  jti: string
}

export class InvalidOAuthAccessTokenError extends Error {
  constructor() {
    super("Invalid access token")
    this.name = "InvalidOAuthAccessTokenError"
  }
}

/** 32 random bytes, base64url: codes, refresh tokens and DCR client ids. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Codes and refresh tokens are stored as their SHA-256, never in clear. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** RFC 7636 S256: base64url(sha256(verifier)) must equal the challenge. */
export function pkceS256Matches(codeVerifier: string, codeChallenge: string): boolean {
  const computed = Buffer.from(createHash("sha256").update(codeVerifier).digest("base64url"))
  const expected = Buffer.from(codeChallenge)
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

export function signOAuthAccessToken(claims: OAuthAccessTokenClaims, privateKey: string): string {
  const header = encodeSegment({ alg: "RS256", typ: "at+jwt" })
  const signingInput = `${header}.${encodeSegment(claims)}`
  const signer = createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  return `${signingInput}.${signer.sign(normalizePem(privateKey), "base64url")}`
}

/**
 * Checks the signature, the `at+jwt` type (RFC 9068, so an ID token or an
 * App JWT signed with the same key is refused), issuer, audience and expiry.
 */
export function verifyOAuthAccessToken(params: {
  token: string
  publicKey: string
  issuer: string
  audience: string
  nowSeconds?: number
}): OAuthAccessTokenClaims {
  const [headerSegment, payloadSegment, signatureSegment] = params.token.split(".")
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new InvalidOAuthAccessTokenError()
  }
  const header = decodeSegment(headerSegment) as { alg?: unknown; typ?: unknown }
  if (header.alg !== "RS256" || header.typ !== "at+jwt") {
    throw new InvalidOAuthAccessTokenError()
  }

  const verifier = createVerify("RSA-SHA256")
  verifier.update(`${headerSegment}.${payloadSegment}`)
  verifier.end()
  let isSignatureValid = false
  try {
    isSignatureValid = verifier.verify(
      normalizePem(params.publicKey),
      Buffer.from(signatureSegment, "base64url"),
    )
  } catch {
    throw new InvalidOAuthAccessTokenError()
  }
  if (!isSignatureValid) throw new InvalidOAuthAccessTokenError()

  const claims = decodeSegment(payloadSegment) as Partial<OAuthAccessTokenClaims>
  if (!isAccessTokenClaims(claims)) throw new InvalidOAuthAccessTokenError()
  if (claims.iss !== params.issuer || claims.aud !== params.audience) {
    throw new InvalidOAuthAccessTokenError()
  }
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  const clockSkewSeconds = 30
  if (claims.exp + clockSkewSeconds < nowSeconds) throw new InvalidOAuthAccessTokenError()
  if (claims.iat - clockSkewSeconds > nowSeconds) throw new InvalidOAuthAccessTokenError()
  return claims
}

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"))
  } catch {
    throw new InvalidOAuthAccessTokenError()
  }
}

function isAccessTokenClaims(
  value: Partial<OAuthAccessTokenClaims>,
): value is OAuthAccessTokenClaims {
  return (
    typeof value.iss === "string" &&
    typeof value.aud === "string" &&
    typeof value.sub === "string" &&
    typeof value.client_id === "string" &&
    typeof value.grant_id === "string" &&
    typeof value.scope === "string" &&
    typeof value.iat === "number" &&
    typeof value.exp === "number" &&
    typeof value.jti === "string"
  )
}
