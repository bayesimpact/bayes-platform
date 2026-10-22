import { describe, expect, it } from "vitest"
import { loadHighlighter } from "./highlighter"

describe("loadHighlighter", () => {
  it("highlights a language the Desk knows, by its name or an alias", async () => {
    const highlighter = await loadHighlighter("TS")

    expect(highlighter?.highlight("const answer = 42").lines).toHaveLength(1)
  })

  it("leaves plain the languages it does not know, even named like an object's own keys", async () => {
    for (const language of ["cobol", "constructor", "toString", "__proto__"]) {
      await expect(loadHighlighter(language)).resolves.toBeNull()
    }
  })
})
