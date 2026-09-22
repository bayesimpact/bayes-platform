import {
  buildAppInstallCallbackUrl,
  buildAppInstallDeniedUrl,
  InvalidLoopbackRedirectUriError,
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

  it("builds the one-shot callback URL", () => {
    expect(
      buildAppInstallCallbackUrl({
        redirectUri: "http://127.0.0.1:8787/callback",
        clientId: "client-id",
        clientSecret: "client-secret",
        state: "abc",
      }),
    ).toBe(
      "http://127.0.0.1:8787/callback?client_id=client-id&client_secret=client-secret&state=abc",
    )
  })

  it("builds the OAuth access_denied cancel URL", () => {
    expect(
      buildAppInstallDeniedUrl({
        redirectUri: "http://127.0.0.1:8787/callback",
        state: "abc",
      }),
    ).toBe("http://127.0.0.1:8787/callback?error=access_denied&state=abc")
  })
})
