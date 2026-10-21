import { useLingui } from "@lingui/react/macro"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

/** How long the button shows that the text was copied. */
const COPIED_FEEDBACK_IN_MILLISECONDS = 2000

export type CopyButtonProps = {
  text: string
}

/** Copies a reply's text, and says so for a moment. */
export function CopyButton({ text }: CopyButtonProps) {
  const { t } = useLingui()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_IN_MILLISECONDS)
    } catch (error) {
      // The browser can refuse the clipboard (no focus, no permission): nothing else to do.
      console.error("The reply could not be copied:", error)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isCopied ? t`Copied` : t`Copy the reply`}
      onClick={() => void handleCopy()}
    >
      {isCopied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  )
}
