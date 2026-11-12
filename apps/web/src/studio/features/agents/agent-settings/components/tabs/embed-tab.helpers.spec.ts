import { describe, expect, it } from "vitest"
import { toHelpPageUrl, toPublicApiOrigin } from "./embed-tab.helpers"

describe("toPublicApiOrigin", () => {
  it("removes the /api suffix of the private API", () => {
    expect(toPublicApiOrigin("https://platform.example.org/api")).toBe(
      "https://platform.example.org",
    )
  })

  it("ignores a trailing slash", () => {
    expect(toPublicApiOrigin("https://platform.example.org/api/")).toBe(
      "https://platform.example.org",
    )
  })

  it("keeps a URL without the /api suffix", () => {
    expect(toPublicApiOrigin("http://localhost:3000")).toBe("http://localhost:3000")
  })
})

describe("toHelpPageUrl", () => {
  it("opens the page in the language of the app", () => {
    expect(toHelpPageUrl("https://help.example.org/", "fr-FR", "public-chat-api")).toBe(
      "https://help.example.org/fr/public-chat-api",
    )
  })

  it("falls back to English", () => {
    expect(toHelpPageUrl("https://help.example.org", "de", "agent-embed")).toBe(
      "https://help.example.org/en/agent-embed",
    )
  })

  it("returns null without a help center", () => {
    expect(toHelpPageUrl(undefined, "fr", "agent-embed")).toBeNull()
  })
})
