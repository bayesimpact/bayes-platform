import { describe, expect, it } from "vitest"
import { buildDefaultToolName } from "./agent-sub-agents.helpers"

describe("buildDefaultToolName", () => {
  it("puts the name in lower case, with an underscore between the words", () => {
    expect(buildDefaultToolName("Helpful Assistant")).toBe("ask_helpful_assistant")
  })

  it("replaces an accented letter with its base letter", () => {
    expect(buildDefaultToolName("Endométriose")).toBe("ask_endometriose")
    expect(buildDefaultToolName("Grand âge")).toBe("ask_grand_age")
  })

  it("replaces an accented letter written as a letter and a combining accent", () => {
    expect(buildDefaultToolName("Protégé")).toBe("ask_protege")
  })

  it("spells out the letters that have no base letter", () => {
    expect(buildDefaultToolName("Œuvre et Straße")).toBe("ask_oeuvre_et_strasse")
  })

  it("removes the punctuation at the start and at the end", () => {
    expect(buildDefaultToolName("  (Pricing & Support!)  ")).toBe("ask_pricing_support")
  })

  it("falls back to a generic name when no letter or digit is left", () => {
    expect(buildDefaultToolName("日本語")).toBe("ask_sub_agent")
  })
})
