import { fireEvent, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { type Annotation, saveAnnotation } from "../annotation"
import { QuoteReplyPopover } from "./QuoteReplyPopover"

const REPLY = "The Pro plan covers unlimited teams."

function AnnotatedReply() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  return (
    <>
      <QuoteReplyPopover
        annotations={annotations}
        onSave={(annotation) => setAnnotations((current) => saveAnnotation(current, annotation))}
        messageBoxId="message-box"
        firstNumber={1}
        onReplyClick={() => {}}
      >
        <div data-annotation-layer="">
          <p data-quotable="">{REPLY}</p>
        </div>
      </QuoteReplyPopover>
      <textarea id="message-box" aria-label="Message" />
    </>
  )
}

/** Selects a word of the reply, as the keyboard, a finger or the mouse does. */
function selectWord(word: string) {
  const paragraph = screen.getByText(REPLY)
  const text = paragraph.firstChild
  if (!text) throw new Error("The reply has no text")
  const start = REPLY.indexOf(word)
  const range = document.createRange()
  range.setStart(text, start)
  range.setEnd(text, start + word.length)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event("selectionchange"))
  return paragraph
}

describe("QuoteReplyPopover", () => {
  it("opens the note of a passage selected without a mouse", async () => {
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")

    expect(
      await screen.findByRole("textbox", { name: "Your note on this passage" }),
    ).toBeInTheDocument()
    expect(screen.getByText("unlimited", { selector: "blockquote" })).toBeInTheDocument()
  })

  it("opens the note once the mouse that selects comes up", async () => {
    renderWithI18n(<AnnotatedReply />)
    const paragraph = screen.getByText(REPLY)

    fireEvent.mouseDown(paragraph)
    selectWord("teams")
    expect(screen.queryByRole("textbox", { name: "Your note on this passage" })).toBeNull()
    fireEvent.mouseUp(paragraph)

    expect(
      await screen.findByRole("textbox", { name: "Your note on this passage" }),
    ).toBeInTheDocument()
  })
})
