import { useLingui } from "@lingui/react/macro"
import { useRef } from "react"
import { toast } from "sonner"
import { LOCALES, type Locale } from "@/app/i18n"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"

/** The speech language of each language of the Desk. */
const SPEECH_LANGUAGES: Record<Locale, string> = { fr: "fr-FR", en: "en-US" }

type UseDictationOptions = {
  content: string
  onContentChange: (content: string) => void
}

/**
 * Dictation into the message box, in the Desk's language: what the person says joins what they
 * wrote before they started, as they say it.
 */
export function useDictation({ content, onContentChange }: UseDictationOptions) {
  const { t, i18n } = useLingui()
  const locale = LOCALES.find((known) => known === i18n.locale) ?? "en"
  // What the box held when the dictation started, which the spoken words follow.
  const prefixRef = useRef("")
  // Stopped by the person or a sent message: a late word must not write the box again.
  const isActiveRef = useRef(false)
  const recognition = useSpeechRecognition({
    language: SPEECH_LANGUAGES[locale],
    onTranscript: (transcript) => {
      if (!isActiveRef.current || transcript === "") return
      onContentChange(`${prefixRef.current}${transcript}`)
    },
    onFailure: (failure) =>
      toast.error(
        failure === "notAllowed"
          ? t`The Desk may not use your microphone. Allow it in your browser, then try again.`
          : t`The dictation stopped. Try again.`,
      ),
  })

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
