import { describe, expect, it } from "vitest"
import { annotationLine, appendAnnotation } from "./annotation"

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

describe("appendAnnotation", () => {
  it("adds the line after what is written, or starts the message with it", () => {
    expect(appendAnnotation("", "`a` b")).toBe("`a` b")
    expect(appendAnnotation("First thought  \n", "`a` b")).toBe("First thought\n`a` b")
  })
})
