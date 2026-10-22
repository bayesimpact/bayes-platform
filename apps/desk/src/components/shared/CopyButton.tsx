import { useLingui } from "@lingui/react/macro"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** How long the button shows that the text was copied. */
const COPIED_FEEDBACK_IN_MILLISECONDS = 2000

export type CopyButtonProps = {
  text: string
  /** What the button copies, as its tooltip names it. */
  label: string
}

/** Copies a text, such as a message or a value, and says so for a moment. */
export function CopyButton({ text, label: copyLabel }: CopyButtonProps) {
  const { t } = useLingui()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_IN_MILLISECONDS)
    } catch (error) {
      // The browser can refuse the clipboard (no focus, no permission): nothing else to do.
      console.error("The text could not be copied:", error)
    }
  }

  const label = isCopied
    ? t({ message: "Copied", comment: "The copy button, once it copied its text" })
    : copyLabel
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={() => void handleCopy()}
          />
        }
      >
        {isCopied ? (
          <CheckIcon aria-hidden className="size-3.5" />
        ) : (
          <CopyIcon aria-hidden className="size-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
