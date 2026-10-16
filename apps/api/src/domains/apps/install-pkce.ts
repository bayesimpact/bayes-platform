import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/** RFC 7636: only S256 is accepted for app install. */
export const INSTALL_PKCE_METHOD_S256 = "S256" as const

export type InstallPkceMethod = typeof INSTALL_PKCE_METHOD_S256

/** RFC 7636 Appendix B test vectors (S256) — safe for unit/e2e fixtures. */
export const RFC7636_TEST_CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
export const RFC7636_TEST_CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

/** RFC 7636 code verifier: 32 random bytes → 43 base64url chars. */
export function generateInstallCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

/** RFC 7636 S256 challenge: base64url(sha256(verifier)), no padding. */
export function installCodeChallengeS256(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url")
}

export function installPkceChallengeMatches(params: {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: string
}): boolean {
  if (params.codeChallengeMethod !== INSTALL_PKCE_METHOD_S256) return false
  const computed = installCodeChallengeS256(params.codeVerifier)
  const expected = Buffer.from(computed)
  const received = Buffer.from(params.codeChallenge)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
