import { useEffect, useRef, useState } from "react"

/** The parts of the browser's speech recognition the Desk uses, which TypeScript does not type. */
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean
  readonly 0: { readonly transcript: string }
}

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number
  readonly results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionErrorEventLike = Event & { readonly error: string }

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  // Safe: the two names browsers give the same constructor, which lib.dom does not declare.
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

/** Why the recognition stopped on its own: the microphone was refused, or something else. */
type SpeechRecognitionFailure = "notAllowed" | "other"

type UseSpeechRecognitionOptions = {
  /** The language of the speech, as a BCP 47 tag: `fr-FR`, `en-US`. */
  language: string
  onFailure?: (failure: SpeechRecognitionFailure) => void
}

/**
 * The browser's speech recognition, which writes what the person says as they say it: the text
 * grows with the words not yet settled, and keeps the settled ones. It runs in the browser,
 * outside React, which an effect follows. `isSupported` is false where the browser has none.
 */
export function useSpeechRecognition({ language, onFailure }: UseSpeechRecognitionOptions) {
  const [isSupported] = useState(() => speechRecognitionConstructor() !== null)
  const [state, setState] = useState<{ isListening: boolean; transcript: string }>({
    isListening: false,
    transcript: "",
  })
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const settledRef = useRef("")
  // Read through a ref, so a new handler never restarts the recognition.
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure

  useEffect(() => {
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognitionRef.current = recognition

    const handleResult = (event: Event) => {
      // Safe: the browser sends its speech results on this event.
      const speechEvent = event as SpeechRecognitionEventLike
      let unsettled = ""
      let settled = settledRef.current
      for (let index = speechEvent.resultIndex; index < speechEvent.results.length; index += 1) {
        const result = speechEvent.results[index]
        if (!result) continue
        if (result.isFinal) settled += result[0].transcript
        else unsettled += result[0].transcript
      }
      settledRef.current = settled
      setState((current) => ({ ...current, transcript: `${settled}${unsettled}`.trim() }))
    }
    const handleError = (event: Event) => {
      // Safe: the browser sends its recognition errors on this event.
      const { error } = event as SpeechRecognitionErrorEventLike
      // Silence or an aborted start is no failure the person must hear about.
      if (error === "no-speech" || error === "aborted") return
      console.error("The speech recognition failed:", error)
      onFailureRef.current?.(
        error === "not-allowed" || error === "service-not-allowed" ? "notAllowed" : "other",
      )
    }
    const handleStart = () => setState((current) => ({ ...current, isListening: true }))
    const handleEnd = () => setState((current) => ({ ...current, isListening: false }))

    recognition.addEventListener("result", handleResult)
    recognition.addEventListener("error", handleError)
    recognition.addEventListener("start", handleStart)
    recognition.addEventListener("end", handleEnd)
    return () => {
      recognition.removeEventListener("result", handleResult)
      recognition.removeEventListener("error", handleError)
      recognition.removeEventListener("start", handleStart)
      recognition.removeEventListener("end", handleEnd)
      try {
        recognition.stop()
      } catch {
        // It was not listening: there is nothing to stop.
      }
      recognitionRef.current = null
    }
  }, [language])

  const start = () => {
    settledRef.current = ""
    setState((current) => ({ ...current, transcript: "" }))
    try {
      recognitionRef.current?.start()
    } catch (error) {
      // Started twice, as a double click does: the first start goes on.
      console.error("The speech recognition could not start:", error)
    }
  }

  const stop = () => recognitionRef.current?.stop()

  return { isSupported, isListening: state.isListening, transcript: state.transcript, start, stop }
}
