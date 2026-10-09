import {
  assertAllowedInstallRedirectUri,
  buildAppInstallCallbackUrl,
  buildAppInstallDeniedUrl,
  InvalidInstallRedirectUriError,
  InvalidLoopbackRedirectUriError,
  isAllowedInstallRedirectUri,
  isHttpRedirectUri,
  isLoopbackRedirectUri,
  parseLoopbackRedirectUri,
} from "@caseai-connect/api-contracts"

describe("loopback redirect URIs", () => {
  it("accepts RFC 8252 loopback hosts", () => {
    expect(isLoopbackRedirectUri("http://127.0.0.1:8787/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://localhost:8787/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://[::1]:8787/callback")).toBe(true)
    expect(parseLoopbackRedirectUri("http://127.0.0.1:8787/callback").hostname).toBe("127.0.0.1")
  })

  it("rejects non-loopback and non-http(s) URIs", () => {
    expect(isLoopbackRedirectUri("https://example.com/callback")).toBe(false)
    expect(isLoopbackRedirectUri("http://192.168.1.10/callback")).toBe(false)
    expect(isLoopbackRedirectUri("javascript:alert(1)")).toBe(false)
    expect(() => parseLoopbackRedirectUri("https://evil.example/callback")).toThrow(
      InvalidLoopbackRedirectUriError,
    )
  })

  it("builds the one-shot callback URL with a code", () => {
    expect(
      buildAppInstallCallbackUrl({
        redirectUri: "http://127.0.0.1:8787/callback",
        code: "install-code",
        state: "abc",
      }),
    ).toBe("http://127.0.0.1:8787/callback?code=install-code&state=abc")
  })

  it("builds the OAuth access_denied cancel URL", () => {
    expect(
      buildAppInstallDeniedUrl({
        redirectUri: "http://127.0.0.1:8787/callback",
        state: "abc",
      }),
    ).toBe("http://127.0.0.1:8787/callback?error=access_denied&state=abc")
  })

  it("builds callback URLs for registered HTTPS redirects with a code only", () => {
    expect(
      buildAppInstallCallbackUrl({
        redirectUri: "https://app.example.com/auth/bayes/callback",
        code: "install-code",
        state: "abc",
      }),
    ).toBe("https://app.example.com/auth/bayes/callback?code=install-code&state=abc")
  })
})

describe("allowed install redirect URIs", () => {
  const allowlist = [
    "http://localhost:3100/auth/bayes/callback",
    "https://site-crawler.staging.bayes.org/auth/bayes/callback",
  ]

  it("accepts loopback without allowlist registration", () => {
    expect(isAllowedInstallRedirectUri("http://127.0.0.1:8787/callback", [])).toBe(true)
    expect(isHttpRedirectUri("https://app.example.com/callback")).toBe(true)
  })

  it("accepts exact allowlist matches", () => {
    const localCallback = "http://localhost:3100/auth/bayes/callback"
    expect(
      isAllowedInstallRedirectUri(
        "https://site-crawler.staging.bayes.org/auth/bayes/callback",
        allowlist,
      ),
    ).toBe(true)
    expect(assertAllowedInstallRedirectUri(localCallback, allowlist)).toBe(localCallback)
  })

  it("rejects non-allowlisted non-loopback URIs", () => {
    expect(isAllowedInstallRedirectUri("https://evil.example/callback", allowlist)).toBe(false)
    expect(
      isAllowedInstallRedirectUri(
        "https://site-crawler.staging.bayes.org/auth/bayes/callback/",
        allowlist,
      ),
    ).toBe(false)
    expect(() =>
      assertAllowedInstallRedirectUri("https://evil.example/callback", allowlist),
    ).toThrow(InvalidInstallRedirectUriError)
  })
})
