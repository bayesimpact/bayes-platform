import { describe, expect, it } from "vitest"
import { toHttpsUrl } from "./safe-url"

describe("toHttpsUrl", () => {
  it("keeps https URLs, and http ones only when allowed", () => {
    expect(toHttpsUrl("https://example.org/a")).toBe("https://example.org/a")
    expect(toHttpsUrl("http://example.org/a")).toBeNull()
    expect(toHttpsUrl("http://example.org/a", { allowHttp: true })).toBe("http://example.org/a")
  })

  it("refuses scripts and what is not a URL", () => {
    expect(toHttpsUrl("javascript:alert(1)", { allowHttp: true })).toBeNull()
    expect(toHttpsUrl("not a url")).toBeNull()
  })
})
