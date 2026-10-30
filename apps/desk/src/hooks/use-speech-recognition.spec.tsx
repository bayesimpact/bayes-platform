import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSpeechRecognition } from "./use-speech-recognition"

/** A browser's speech recognition that refuses a second start, as Chrome does. */
class StrictSpeechRecognition extends EventTarget {
  static current: StrictSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ""
  isStarted = false

  constructor() {
    super()
    StrictSpeechRecognition.current = this
  }

  start() {
    if (this.isStarted) throw new DOMException("already started", "InvalidStateError")
    this.isStarted = true
    this.dispatchEvent(new Event("start"))
  }

  stop() {
    this.isStarted = false
    this.dispatchEvent(new Event("end"))
  }

  say(transcripts: { transcript: string; isFinal: boolean }[]) {
    const results = transcripts.map(({ transcript, isFinal }) =>
      Object.assign([{ transcript }], { isFinal }),
    )
    this.dispatchEvent(Object.assign(new Event("result"), { resultIndex: 0, results }))
  }

  fail(error: string) {
    this.dispatchEvent(Object.assign(new Event("error"), { error }))
  }
}

beforeEach(() => {
  vi.stubGlobal("SpeechRecognition", StrictSpeechRecognition)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  StrictSpeechRecognition.current = null
})

describe("useSpeechRecognition", () => {
  it("hands over the settled words and those not settled yet, as they come", () => {
    const onTranscript = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition({ language: "en-US", onTranscript }))

    act(() => result.current.start())
    expect(result.current.isListening).toBe(true)
    act(() =>
      StrictSpeechRecognition.current?.say([
        { transcript: "Hello ", isFinal: true },
        { transcript: "there", isFinal: false },
      ]),
    )

    expect(onTranscript).toHaveBeenLastCalledWith("Hello there")
  })

  it("lets a second start go by without an error, as a double click does", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: "en-US", onTranscript: vi.fn() }),
    )

    act(() => result.current.start())
    act(() => result.current.start())

    expect(result.current.isListening).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("says when the microphone is refused", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onFailure = vi.fn()
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: "en-US", onTranscript: vi.fn(), onFailure }),
    )

    act(() => result.current.start())
    act(() => StrictSpeechRecognition.current?.fail("not-allowed"))

    expect(onFailure).toHaveBeenCalledWith("notAllowed")
  })
})
