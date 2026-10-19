import {
  InvalidLoopbackRedirectUriError,
  isAllowedInstallRedirectUri,
  isHttpRedirectUri,
  isLoopbackHostname,
  isLoopbackRedirectUri,
  parseLoopbackRedirectUri,
} from "@caseai-connect/api-contracts"

describe("loopback redirect URIs", () => {
  it("accepts RFC 8252 loopback hosts and RFC 6761 *.localhost", () => {
    expect(isLoopbackRedirectUri("http://127.0.0.1:8787/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://localhost:8787/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://[::1]:8787/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://acme.localhost/auth/bayes/callback")).toBe(true)
    expect(isLoopbackRedirectUri("http://foo.bar.localhost:3100/callback")).toBe(true)
    expect(isLoopbackHostname("acme.localhost")).toBe(true)
    expect(parseLoopbackRedirectUri("http://127.0.0.1:8787/callback").hostname).toBe("127.0.0.1")
  })

  it("rejects non-loopback and non-http(s) URIs", () => {
    expect(isLoopbackRedirectUri("https://example.com/callback")).toBe(false)
    expect(isLoopbackRedirectUri("http://192.168.1.10/callback")).toBe(false)
    expect(isLoopbackRedirectUri("http://localhost.evil.com/callback")).toBe(false)
    expect(isLoopbackRedirectUri("javascript:alert(1)")).toBe(false)
    expect(() => parseLoopbackRedirectUri("https://evil.example/callback")).toThrow(
      InvalidLoopbackRedirectUriError,
    )
  })
})

describe("redirect URIs of an app", () => {
  const allowlist = [
    "http://localhost:3100/auth/bayes/callback",
    "https://app.example.com/auth/bayes/callback",
    "http://app.example.org/callback",
  ]

  it("accepts loopback without registration", () => {
    expect(isAllowedInstallRedirectUri("http://127.0.0.1:8787/callback", [])).toBe(true)
    expect(isAllowedInstallRedirectUri("http://acme.localhost/callback", [])).toBe(true)
    expect(isHttpRedirectUri("https://app.example.com/callback")).toBe(true)
  })

  it("accepts exact https matches", () => {
    expect(
      isAllowedInstallRedirectUri("https://app.example.com/auth/bayes/callback", allowlist),
    ).toBe(true)
    expect(
      isAllowedInstallRedirectUri("http://localhost:3100/auth/bayes/callback", allowlist),
    ).toBe(true)
  })

  it("rejects non-loopback http even when listed", () => {
    expect(isAllowedInstallRedirectUri("http://app.example.org/callback", allowlist)).toBe(false)
  })

  it("rejects unregistered non-loopback URIs", () => {
    expect(isAllowedInstallRedirectUri("https://evil.example/callback", allowlist)).toBe(false)
    expect(
      isAllowedInstallRedirectUri("https://app.example.com/auth/bayes/callback/", allowlist),
    ).toBe(false)
  })
})
