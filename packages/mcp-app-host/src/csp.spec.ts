import { describe, expect, it } from "vitest"
import { buildMcpAppCsp, toCspSources, withMcpAppCsp } from "./csp"

describe("buildMcpAppCsp", () => {
  it("blocks every network access when the app declares nothing", () => {
    const policy = buildMcpAppCsp(undefined)

    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain("connect-src 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("script-src 'self' 'unsafe-inline';")
    expect(policy).toContain("form-action 'none'")
  })

  it("opens only the declared origins, each on its own directives", () => {
    const policy = buildMcpAppCsp({
      connectDomains: ["https://api.example.com"],
      resourceDomains: ["https://*.cdn.example.com"],
      frameDomains: ["https://video.example.com"],
    })

    expect(policy).toContain("connect-src https://api.example.com;")
    expect(policy).toContain("script-src 'self' 'unsafe-inline' https://*.cdn.example.com;")
    expect(policy).toContain("img-src 'self' data: https://*.cdn.example.com;")
    expect(policy).toContain("frame-src https://video.example.com;")
    expect(policy).not.toContain("connect-src 'none'")
  })
})

describe("toCspSources", () => {
  it("keeps origins with a scheme, a host and an optional port", () => {
    expect(
      toCspSources([
        "https://example.com",
        "wss://live.example.com:8443",
        "http://localhost:3000",
        "https://*.example.com",
      ]),
    ).toEqual([
      "https://example.com",
      "wss://live.example.com:8443",
      "http://localhost:3000",
      "https://*.example.com",
    ])
  })

  it("drops values that would change the policy instead of naming an origin", () => {
    expect(
      toCspSources([
        "https://example.com; script-src *",
        "'unsafe-eval'",
        "*",
        "https://*",
        "data:",
        "example.com",
        'https://example.com"><script>',
        "https://example.com/path",
      ]),
    ).toEqual([])
  })
})

describe("withMcpAppCsp", () => {
  const meta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'">`

  it("puts the policy right after the doctype", () => {
    expect(withMcpAppCsp("<!DOCTYPE html><html><head></head></html>", "default-src 'none'")).toBe(
      `<!DOCTYPE html>${meta}<html><head></head></html>`,
    )
  })

  it("puts the policy first when the document has no doctype", () => {
    expect(withMcpAppCsp("<script>run()</script>", "default-src 'none'")).toBe(
      `${meta}<script>run()</script>`,
    )
  })
})
