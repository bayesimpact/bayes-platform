import { describe, expect, it } from "vitest"
import { annotationLine, composeMessage, saveAnnotation } from "./annotation"

describe("annotationLine", () => {
  it("quotes the passage on one line, then the note", () => {
    expect(annotationLine("the Pro\n plan", "  is it per seat? ")).toBe(
      "`the Pro plan` is it per seat?",
    )
  })

  it("keeps the passage alone without a note, and its backticks cannot close it", () => {
    expect(annotationLine("use `webhooks`", "")).toBe("`use 'webhooks'`")
  })
})

describe("saveAnnotation", () => {
  const first = { id: crypto.randomUUID(), note: "is it per seat?" }
  const second = { id: crypto.randomUUID(), note: "and for teams?" }

  it("adds a new annotation last, and puts an edited one in its place", () => {
    const saved = saveAnnotation([first], second)
    expect(saved).toEqual([first, second])
    expect(saveAnnotation(saved, { ...first, note: "per seat?" })).toEqual([
      { ...first, note: "per seat?" },
      second,
    ])
  })

  it("removes an annotation whose note was emptied, and never adds one without a note", () => {
    expect(saveAnnotation([first, second], { ...first, note: "  " })).toEqual([second])
    expect(saveAnnotation([first], { id: crypto.randomUUID(), note: "" })).toEqual([first])
  })
})

describe("composeMessage", () => {
  it("puts each annotation on a line of its own after what is written", () => {
    const annotations = [
      { passage: "Pro plan", note: "is it per seat?" },
      { passage: "webhooks", note: "which events?" },
    ]
    expect(composeMessage("First thought  \n", annotations)).toBe(
      "First thought\n`Pro plan` is it per seat?\n`webhooks` which events?",
    )
    expect(composeMessage("", annotations.slice(0, 1))).toBe("`Pro plan` is it per seat?")
  })
})
