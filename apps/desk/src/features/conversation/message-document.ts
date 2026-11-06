import type { JSONContent } from "@tiptap/react"
import { codeSegmentsOf } from "./annotation"

/**
 * The message box holds a document, the rest of the Desk a string: a line per paragraph, and the
 * passages between backticks as code. These two functions go from one to the other, so that what
 * the box shows as chips leaves as the text the agent reads.
 */

/** The document of a message: one paragraph per line, its passages between backticks as code. */
export function messageDocumentOf(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map((line) => {
      const segments = codeSegmentsOf(line)
      return segments.length === 0
        ? { type: "paragraph" }
        : {
            type: "paragraph",
            content: segments.map((segment) =>
              segment.kind === "code"
                ? { type: "text", text: segment.text, marks: [{ type: "code" }] }
                : { type: "text", text: segment.text },
            ),
          }
    }),
  }
}

/** The text of a message's document: its lines, with each passage in code between backticks. */
export function messageTextOf(document: JSONContent): string {
  return (document.content ?? [])
    .map((paragraph) =>
      (paragraph.content ?? [])
        .map((node) => {
          if (node.type === "hardBreak") return "\n"
          const text = node.text ?? ""
          return node.marks?.some((mark) => mark.type === "code") ? `\`${text}\`` : text
        })
        .join(""),
    )
    .join("\n")
}
