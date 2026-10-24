import { describe, expect, it } from "vitest"
import { messageDocumentOf, messageTextOf } from "./message-document"

describe("messageDocumentOf and messageTextOf", () => {
  it("turn the passages between backticks into code, line by line, and back", () => {
    const text = "Compare these:\n`[Company Name]` Toto Inc.\n\n`Your Title` CEO"
    const document = messageDocumentOf(text)

    expect(document.content?.[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "[Company Name]", marks: [{ type: "code" }] },
        { type: "text", text: " Toto Inc." },
      ],
    })
    expect(document.content?.[2]).toEqual({ type: "paragraph" })
    expect(messageTextOf(document)).toBe(text)
  })

  it("read a line break inside a paragraph as a new line", () => {
    expect(
      messageTextOf({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "one" },
              { type: "hardBreak" },
              { type: "text", text: "two" },
            ],
          },
        ],
      }),
    ).toBe("one\ntwo")
  })
})
