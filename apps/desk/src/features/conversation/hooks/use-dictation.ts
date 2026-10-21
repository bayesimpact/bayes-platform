import { useLingui } from "@lingui/react/macro"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"

/** The speech language of each language of the Desk. */
const SPEECH_LANGUAGES: Record<string, string> = { fr: "fr-FR", en: "en-US" }

type UseDictationOptions = {
  content: string
  onContentChange: (content: string) => void
}

/**
 * Dictation into the message box, in the Desk's language: what the person says joins what they
 * wrote before they started, as they say it. The transcript comes from the browser, which an
 * effect copies into the box.
 */
export function useDictation({ content, onContentChange }: UseDictationOptions) {
  const { t, i18n } = useLingui()
  const recognition = useSpeechRecognition({
    language: SPEECH_LANGUAGES[i18n.locale] ?? "en-US",
    onFailure: (failure) =>
      toast.error(
        failure === "notAllowed"
          ? t`The Desk may not use your microphone. Allow it in your browser, then try again.`
          : t`The dictation stopped. Try again.`,
      ),
  })
  // What the box held when the dictation started, which the spoken words follow.
  const prefixRef = useRef("")
  // Stopped by the person or a sent message: a late word must not write the box again.
  const isActiveRef = useRef(false)
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  useEffect(() => {
    if (!isActiveRef.current || recognition.transcript === "") return
    onContentChangeRef.current(`${prefixRef.current}${recognition.transcript}`)
  }, [recognition.transcript])

  const start = () => {
    const written = content.trimEnd()
    prefixRef.current = written === "" ? "" : `${written} `
    isActiveRef.current = true
    recognition.start()
  }

  const stop = () => {
    isActiveRef.current = false
    recognition.stop()
  }

  return {
    isSupported: recognition.isSupported,
    isListening: recognition.isListening,
    toggle: () => (recognition.isListening ? stop() : start()),
    stop,
  }
}
