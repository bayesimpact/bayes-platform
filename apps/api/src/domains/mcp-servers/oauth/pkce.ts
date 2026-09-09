import { createHash, randomBytes } from "node:crypto"

/** RFC 7636 code verifier: 32 random bytes → 43 base64url chars. */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

/** RFC 7636 S256 challenge: base64url(sha256(verifier)), no padding. */
export function codeChallengeS256(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url")
}

/** Opaque anti-CSRF value for the authorization request. */
export function generateState(): string {
  return randomBytes(24).toString("base64url")
}
