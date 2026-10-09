import {
  INSTALL_PKCE_METHOD_S256,
  installCodeChallengeS256,
  installPkceChallengeMatches,
  RFC7636_TEST_CODE_CHALLENGE,
  RFC7636_TEST_CODE_VERIFIER,
} from "./install-pkce"

describe("install PKCE", () => {
  it("matches the RFC 7636 Appendix B S256 vector", () => {
    expect(installCodeChallengeS256(RFC7636_TEST_CODE_VERIFIER)).toBe(RFC7636_TEST_CODE_CHALLENGE)
    expect(
      installPkceChallengeMatches({
        codeVerifier: RFC7636_TEST_CODE_VERIFIER,
        codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
        codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
      }),
    ).toBe(true)
  })

  it("rejects a mismatched verifier", () => {
    expect(
      installPkceChallengeMatches({
        codeVerifier: `${RFC7636_TEST_CODE_VERIFIER}x`,
        codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
        codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
      }),
    ).toBe(false)
  })
})
