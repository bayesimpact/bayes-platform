import { Button } from "@caseai-connect/ui/shad/button"
import { MicIcon } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useChatFooter } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/context"
import { useSpeechRecognition } from "@/common/hooks/use-speech-recognition"
import { getSpeechRecognitionLanguage } from "@/common/utils/get-locale"

export function Dictaphone({ disabled }: { disabled: boolean }) {
  const { input } = useChatFooter()
  const { i18n } = useTranslation()
  const { supported, listening, transcript, start, stop, resetTranscript } = useSpeechRecognition({
    language: getSpeechRecognitionLanguage(i18n.language),
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: do not add input to deps to avoid loop
  useEffect(() => {
    if (transcript.length > 0) input.setValue(transcript)
  }, [transcript])

  useEffect(() => {
    if (input.value.trim().length === 0) resetTranscript()
  }, [input.value, resetTranscript])

  useEffect(() => {
    if (!listening) input.setDisabled(false)
  }, [listening, input])

  if (!supported) return null

  const handleClick = () => {
    if (listening) {
      stop()
    } else {
      input.setDisabled(true)
      start()
    }
  }

  return (
    <Button variant={listening ? "default" : "ghost"} disabled={disabled} onClick={handleClick}>
      <MicIcon className={listening ? "animate-pulse" : ""} />
    </Button>
  )
}
