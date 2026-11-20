import { describe, expect, it } from "vitest"
import { thinkingLevelOf } from "./thinking-level"

describe("thinkingLevelOf", () => {
  it("finds the thinking level under the name each provider gives it, at any depth", () => {
    expect(thinkingLevelOf({ google: { thinkingConfig: { thinkingLevel: "low" } } })).toBe("low")
    expect(thinkingLevelOf({ openai: { reasoningEffort: "high" } })).toBe("high")
    expect(thinkingLevelOf({ effort: "medium" })).toBe("medium")
  })

  it("is null when the options hold none", () => {
    expect(thinkingLevelOf({})).toBeNull()
    expect(thinkingLevelOf({ google: { temperature: 0.2 } })).toBeNull()
  })
})
