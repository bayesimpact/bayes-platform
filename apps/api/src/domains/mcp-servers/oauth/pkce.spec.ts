import { createHash } from "node:crypto"
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce"

describe("pkce", () => {
  it("generates a code verifier of valid RFC 7636 length and charset", () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it("generates unique verifiers and states", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
    expect(generateState()).not.toBe(generateState())
  })

  it("computes the S256 challenge as base64url(sha256(verifier))", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const expected = createHash("sha256").update(verifier).digest("base64url")
    expect(codeChallengeS256(verifier)).toBe(expected)
    expect(codeChallengeS256(verifier)).not.toContain("=")
  })
})
