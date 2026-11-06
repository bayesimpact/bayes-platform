import { describe, expect, it } from "vitest"
import { getMcpAppMessageText, isOpenableLink } from "./sandbox"

describe("getMcpAppMessageText", () => {
  it("joins the text blocks of a message the app proposes", () => {
    expect(
      getMcpAppMessageText([
        { type: "text", text: "`First we migrate the database.` Back it up first." },
        { type: "image", data: "...", mimeType: "image/png" },
        { type: "text", text: "`switch traffic` When exactly?" },
      ]),
    ).toBe("`First we migrate the database.` Back it up first.\n\n`switch traffic` When exactly?")
  })

  it("is empty when the message carries no text", () => {
    expect(getMcpAppMessageText([])).toBe("")
    expect(getMcpAppMessageText([{ type: "text", text: "  \n" }])).toBe("")
    expect(getMcpAppMessageText([{ type: "image", data: "...", mimeType: "image/png" }])).toBe("")
  })
})

describe("isOpenableLink", () => {
  it("accepts https and http URLs", () => {
    expect(isOpenableLink("https://example.com/file.pdf")).toBe(true)
    expect(isOpenableLink("http://example.com/file.pdf")).toBe(true)
  })

  it("rejects javascript, data, blob and mailto URLs", () => {
    expect(isOpenableLink("javascript:alert(1)")).toBe(false)
    expect(isOpenableLink("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isOpenableLink("blob:https://example.com/uuid")).toBe(false)
    expect(isOpenableLink("mailto:someone@example.com")).toBe(false)
  })

  it("rejects relative paths and unparsable strings", () => {
    expect(isOpenableLink("/relative/path")).toBe(false)
    expect(isOpenableLink("not a url")).toBe(false)
  })
})
