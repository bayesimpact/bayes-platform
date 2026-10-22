import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { renderWithI18n } from "@/test/render-with-i18n"
import type { OutgoingMessage } from "../chat-messages"
import { Composer } from "./Composer"

/** A browser's speech recognition that the test makes speak. */
class FakeSpeechRecognition extends EventTarget {
  static current: FakeSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ""

  constructor() {
    super()
    FakeSpeechRecognition.current = this
  }

  start() {
    this.dispatchEvent(new Event("start"))
  }

  stop() {
    this.dispatchEvent(new Event("end"))
  }

  say(transcript: string, isFinal: boolean) {
    const result = Object.assign([{ transcript }], { isFinal })
    this.dispatchEvent(Object.assign(new Event("result"), { resultIndex: 0, results: [result] }))
  }
}

function ComposerWithDraft({ onSend }: { onSend: (message: OutgoingMessage) => void }) {
  const [draft, setDraft] = useState("")
  return (
    <Composer
      agentName="Helpful Assistant"
      content={draft}
      onContentChange={setDraft}
      isBusy={false}
      onSend={onSend}
    />
  )
}

beforeEach(() => {
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition)
})

afterEach(() => {
  vi.unstubAllGlobals()
  FakeSpeechRecognition.current = null
})

describe("the dictation", () => {
  it("adds what the person says after what they wrote, until they stop or send", async () => {
    const onSend = vi.fn()
    renderWithI18n(<ComposerWithDraft onSend={onSend} />)
    const messageBox = screen.getByRole("textbox", { name: "Message to Helpful Assistant" })
    await userEvent.type(messageBox, "Hello")

    await userEvent.click(screen.getByRole("button", { name: "Dictate your message" }))
    expect(FakeSpeechRecognition.current?.lang).toBe("en-US")
    act(() => FakeSpeechRecognition.current?.say("how are", false))
    expect(messageBox).toHaveValue("Hello how are")
    act(() => FakeSpeechRecognition.current?.say("how are you?", true))
    expect(messageBox).toHaveValue("Hello how are you?")

    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(onSend).toHaveBeenCalledWith({ content: "Hello how are you?", attachment: null })
    // A word heard after the message left does not write the box again.
    act(() => FakeSpeechRecognition.current?.say("late", true))
    expect(messageBox).toHaveValue("")
    expect(screen.getByRole("button", { name: "Dictate your message" })).toBeInTheDocument()
  })

  it("is not offered by a browser without speech recognition", () => {
    vi.unstubAllGlobals()
    renderWithI18n(<ComposerWithDraft onSend={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Dictate your message" })).not.toBeInTheDocument()
  })
})

describe("the attachment", () => {
  /** Picks a file in the paperclip's picker, which has no name of its own: it is hidden. */
  async function pickFile(file: File) {
    const onSend = vi.fn()
    const { container } = renderWithI18n(
      <>
        <ComposerWithDraft onSend={onSend} />
        <Toaster />
      </>,
    )
    const picker = container.querySelector<HTMLInputElement>("input[type=file]")
    if (!picker) throw new Error("The composer has no file picker")
    await userEvent.upload(picker, file, { applyAccept: false })
    return onSend
  }

  it("leaves with the message", async () => {
    const file = new File(["%PDF"], "plan.pdf", { type: "application/pdf" })
    const onSend = await pickFile(file)

    await userEvent.type(screen.getByRole("textbox"), "Read this{Enter}")

    expect(onSend).toHaveBeenCalledWith({ content: "Read this", attachment: { file } })
  })

  it("refuses a file the contract refuses, and names its limits", async () => {
    const tooLarge = new File(["%PDF"], "plan.pdf", { type: "application/pdf" })
    Object.defineProperty(tooLarge, "size", { value: 11 * 1000 * 1000 })
    await pickFile(tooLarge)
    expect(await screen.findByText("Attach a file of 10 MB at most.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove plan.pdf" })).not.toBeInTheDocument()
  })

  it("refuses a file of another type", async () => {
    await pickFile(new File(["text"], "notes.txt", { type: "text/plain" }))
    expect(await screen.findByText("Attach a PDF, PNG or JPEG file.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove notes.txt" })).not.toBeInTheDocument()
  })
})
