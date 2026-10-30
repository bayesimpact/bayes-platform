import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { MicIcon } from "lucide-react"
import { InputGroupButton } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type DictationButtonProps = {
  isListening: boolean
  onToggle: () => void
}

/** The microphone of the message box: it starts the dictation, and stops it. */
export function DictationButton({ isListening, onToggle }: DictationButtonProps) {
  const { t } = useLingui()
  const label = isListening ? t`Stop the dictation` : t`Dictate your message`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <InputGroupButton
            size="icon-sm"
            variant={isListening ? "default" : "ghost"}
            aria-label={label}
            aria-pressed={isListening}
            onClick={onToggle}
            className={cn(
              "size-8 rounded-full transition-colors duration-200",
              !isListening && "text-muted-foreground hover:text-foreground",
            )}
          />
        }
      >
        <MicIcon
          aria-hidden
          className={cn(isListening && "animate-pulse motion-reduce:animate-none")}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
