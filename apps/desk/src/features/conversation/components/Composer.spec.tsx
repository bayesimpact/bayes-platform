import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { writeMessage } from "@/test/message-box"
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
    await writeMessage(messageBox, "Hello")

    await userEvent.click(screen.getByRole("button", { name: "Dictate your message" }))
    expect(FakeSpeechRecognition.current?.lang).toBe("en-US")
    act(() => FakeSpeechRecognition.current?.say("how are", false))
    expect(messageBox.textContent).toBe("Hello how are")
    act(() => FakeSpeechRecognition.current?.say("how are you?", true))
    expect(messageBox.textContent).toBe("Hello how are you?")

    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(onSend).toHaveBeenCalledWith(
      { content: "Hello how are you?", attachment: null },
      expect.any(Function),
    )
    // A word heard after the message left does not write the box again.
    act(() => FakeSpeechRecognition.current?.say("late", true))
    expect(messageBox.textContent).toBe("")
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

    await writeMessage(screen.getByRole("textbox"), "Read this", { send: true })

    expect(onSend).toHaveBeenCalledWith(
      { content: "Read this", attachment: { file } },
      expect.any(Function),
    )
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

describe("the passages between backticks", () => {
  it("become a chip as soon as their second backtick is typed, and leave as text", async () => {
    const onSend = vi.fn()
    renderWithI18n(<ComposerWithDraft onSend={onSend} />)
    const messageBox = screen.getByRole("textbox", { name: "Message to Helpful Assistant" })

    // The tests' DOM feeds the editor badly one key at a time: the text before the second
    // backtick is pasted, then that backtick alone is typed, as the key that makes the chip.
    await writeMessage(messageBox, "Fix `max")
    expect(messageBox.querySelector("code")).toBeNull()
    await userEvent.keyboard("`")
    expect(messageBox.querySelector("code")?.textContent).toBe("max")
    await userEvent.paste(" now")
    expect(messageBox.textContent).toBe("Fix max now")

    await userEvent.keyboard("{Enter}")
    expect(onSend).toHaveBeenCalledWith(
      { content: "Fix `max` now", attachment: null },
      expect.any(Function),
    )
  })

  it("keep their chips when pasted, and Shift+Enter starts a new line", async () => {
    const onSend = vi.fn()
    renderWithI18n(<ComposerWithDraft onSend={onSend} />)
    const messageBox = screen.getByRole("textbox", { name: "Message to Helpful Assistant" })

    await writeMessage(messageBox, "`[Company Name]` Toto Inc.")
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}")
    await userEvent.paste("`Your Title` CEO")
    expect([...messageBox.querySelectorAll("code")].map((chip) => chip.textContent)).toEqual([
      "[Company Name]",
      "Your Title",
    ])

    await userEvent.keyboard("{Enter}")
    expect(onSend).toHaveBeenCalledWith(
      { content: "`[Company Name]` Toto Inc.\n`Your Title` CEO", attachment: null },
      expect.any(Function),
    )
  })
})
