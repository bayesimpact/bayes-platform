import { describe, expect, it } from "vitest"
import { buildReturnTo, sanitizeReturnTo } from "./auth0-return-to"

describe("buildReturnTo", () => {
  it("keeps the query string so single-use callback params survive", () => {
    expect(buildReturnTo({ pathname: "/oauth/mcp/callback", search: "?code=abc&state=xyz" })).toBe(
      "/oauth/mcp/callback?code=abc&state=xyz",
    )
  })

  it("returns the bare pathname when there is no query", () => {
    expect(buildReturnTo({ pathname: "/onboarding", search: "" })).toBe("/onboarding")
  })
})

describe("sanitizeReturnTo", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeReturnTo("/oauth/mcp/callback?code=abc&state=xyz")).toBe(
      "/oauth/mcp/callback?code=abc&state=xyz",
    )
    expect(sanitizeReturnTo("/")).toBe("/")
  })

  it("rejects values that are not strings", () => {
    expect(sanitizeReturnTo(undefined)).toBeNull()
    expect(sanitizeReturnTo(null)).toBeNull()
    expect(sanitizeReturnTo(42)).toBeNull()
    expect(sanitizeReturnTo({ pathname: "/onboarding" })).toBeNull()
  })

  it("rejects absolute URLs and scheme-prefixed values", () => {
    expect(sanitizeReturnTo("https://evil.example/phish")).toBeNull()
    expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull()
    expect(sanitizeReturnTo("evil.example/path")).toBeNull()
    expect(sanitizeReturnTo("")).toBeNull()
  })

  it("rejects protocol-relative and backslash paths", () => {
    expect(sanitizeReturnTo("//evil.example/path")).toBeNull()
    expect(sanitizeReturnTo("/\\evil.example/path")).toBeNull()
  })

  it("rejects paths containing control characters", () => {
    expect(sanitizeReturnTo("/onboarding\nLocation: https://evil.example")).toBeNull()
    expect(sanitizeReturnTo("/onboarding\u0000")).toBeNull()
  })
})
