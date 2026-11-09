import { act, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
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
  it("offers to copy or annotate a passage selected without a mouse, keeping the selection", async () => {
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")

    expect(await screen.findByRole("button", { name: "Copy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annotate" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Your note on this passage" })).toBeNull()
    expect(document.getSelection()?.toString()).toBe("unlimited")
  })

  it("offers the choice once the mouse that selects comes up", async () => {
    renderWithI18n(<AnnotatedReply />)
    const paragraph = screen.getByText(REPLY)

    fireEvent.mouseDown(paragraph)
    selectWord("teams")
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull()
    fireEvent.mouseUp(paragraph)

    expect(await screen.findByRole("button", { name: "Copy" })).toBeInTheDocument()
  })

  it("copies the selected passage and shows that it is copied", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")
    await userEvent.click(await screen.findByRole("button", { name: "Copy" }))

    expect(writeText).toHaveBeenCalledWith("unlimited")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument()
  })

  it("brings the keyboard into the box with Tab", async () => {
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")
    const copyButton = await screen.findByRole("button", { name: "Copy" })
    await userEvent.keyboard("{Tab}")
    expect(copyButton).toHaveFocus()
    await userEvent.keyboard("{Tab}")
    expect(screen.getByRole("button", { name: "Annotate" })).toHaveFocus()
  })

  it("keeps the check its full time after a second copy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }))
    await screen.findByRole("button", { name: "Copied" })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    fireEvent.click(screen.getByRole("button", { name: "Copied" }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("opens the note of the selected passage on Annotate", async () => {
    renderWithI18n(<AnnotatedReply />)

    selectWord("unlimited")
    await userEvent.click(await screen.findByRole("button", { name: "Annotate" }))

    expect(
      await screen.findByRole("textbox", { name: "Your note on this passage" }),
    ).toBeInTheDocument()
    expect(screen.getByText("unlimited", { selector: "blockquote" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull()
  })
})
