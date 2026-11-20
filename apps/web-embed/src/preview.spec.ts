import { describe, expect, it } from "vitest"
import { previewOf } from "./preview"

describe("previewOf", () => {
  it("returns the assistant's opening message while the visitor has not written", () => {
    expect(previewOf([{ role: "assistant", content: "  Hello, how can I help?  " }])).toBe(
      "Hello, how can I help?",
    )
  })

  it("returns null once the visitor has written", () => {
    expect(
      previewOf([
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Hi" },
      ]),
    ).toBeNull()
  })

  it("returns null for an empty conversation or a blank opening", () => {
    expect(previewOf([])).toBeNull()
    expect(previewOf([{ role: "assistant", content: "   " }])).toBeNull()
  })
})
