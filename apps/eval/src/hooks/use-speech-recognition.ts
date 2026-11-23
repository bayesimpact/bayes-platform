import { useEffect, useEffectEvent, useRef, useState } from "react"

function speechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/** Why the recognition stopped on its own: the microphone was refused, or something else. */
type SpeechRecognitionFailure = "notAllowed" | "other"

type UseSpeechRecognitionOptions = {
  /** The language of the speech, as a BCP 47 tag: `fr-FR`, `en-US`. */
  language: string
  /** Called with all the text heard since the start, as it grows. */
  onTranscript: (transcript: string) => void
  onFailure?: (failure: SpeechRecognitionFailure) => void
}

/**
 * The browser's speech recognition, which writes what the person says as they say it: the text
 * grows with the words not yet settled, and keeps the settled ones. It runs in the browser,
 * outside React, which an effect follows. `isSupported` is false where the browser has none.
 */
export function useSpeechRecognition({
  language,
  onTranscript,
  onFailure,
}: UseSpeechRecognitionOptions) {
  const [isSupported] = useState(() => speechRecognitionConstructor() !== null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const settledRef = useRef("")
  // Effect events, so a new handler never restarts the recognition.
  const handleTranscript = useEffectEvent((transcript: string) => onTranscript(transcript))
  const handleFailure = useEffectEvent((failure: SpeechRecognitionFailure) => onFailure?.(failure))

  useEffect(() => {
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognitionRef.current = recognition

    const handleResult = (event: SpeechRecognitionEvent) => {
      let unsettled = ""
      let settled = settledRef.current
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript ?? ""
        if (result?.isFinal) settled += transcript
        else unsettled += transcript
      }
      settledRef.current = settled
      handleTranscript(`${settled}${unsettled}`.trim())
    }
    const handleError = (event: SpeechRecognitionErrorEvent) => {
      // Silence or an aborted start is no failure the person must hear about.
      if (event.error === "no-speech" || event.error === "aborted") return
      console.error("The speech recognition failed:", event.error)
      handleFailure(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "notAllowed"
          : "other",
      )
    }
    const handleStart = () => setIsListening(true)
    const handleEnd = () => setIsListening(false)

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
    const recognition = recognitionRef.current
    if (recognition === null) return
    try {
      recognition.start()
    } catch {
      // Started twice, as a double click does: the first start goes on.
    }
  }

  const stop = () => recognitionRef.current?.stop()

  return { isSupported, isListening, start, stop }
}
