import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
